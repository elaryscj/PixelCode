package com.example.game_backend.service;

import com.example.game_backend.entity.Player;
import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.RoomStatus;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.GameService;
import com.example.game_backend.game.GameSession;
import com.example.game_backend.game.MatchResultService;
import com.example.game_backend.repository.RoomRepository;
import com.example.game_backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/** Rooms: create / join / ready / leave and the five-minute join window (US-32, US-34, US-35). */
@Service
public class RoomService {
    private static final Logger log = LoggerFactory.getLogger(RoomService.class);
    private static final List<RoomStatus> ACTIVE = List.of(RoomStatus.WAITING, RoomStatus.READY, RoomStatus.PLAYING);

    private final RoomRepository rooms;
    private final UserRepository users;
    private final MatchResultService results;
    private final GameService games;
    private final SimpMessagingTemplate messaging;
    private final TransactionTemplate tx;
    private final long joinWindowSeconds;
    private final long staleWaitingMinutes;
    private final Object lock = new Object();

    public RoomService(RoomRepository rooms, UserRepository users, MatchResultService results, GameService games,
                       SimpMessagingTemplate messaging, PlatformTransactionManager tm,
                       @Value("${game.join-window-seconds:300}") long joinWindowSeconds,
                       @Value("${game.stale-room-minutes:30}") long staleWaitingMinutes) {
        this.rooms = rooms;
        this.users = users;
        this.results = results;
        this.games = games;
        this.messaging = messaging;
        this.tx = new TransactionTemplate(tm);
        this.joinWindowSeconds = joinWindowSeconds;
        this.staleWaitingMinutes = staleWaitingMinutes;
    }

    public Map<String, Object> getRoom(String code) {
        Room room = rooms.findByCode(normalize(code)).orElseThrow(() -> new ApiException(404, "Room not found"));
        return view(room);
    }

    public Map<String, Object> mine(long userId) {
        List<Room> active = rooms.findActiveForUser(userId, ACTIVE);
        return active.isEmpty() ? null : view(active.get(0));
    }

    public Map<String, Object> createRoom(long userId) {
        Room room;
        synchronized (lock) {
            room = tx.execute(st -> {
                User u = requireUser(userId);
                ensureNotBanned(u);
                List<Room> active = rooms.findActiveForUser(userId, ACTIVE);
                if (!active.isEmpty()) {
                    Room existing = active.get(0);
                    if (existing.getRoomStatus() == RoomStatus.WAITING) {
                        return existing;
                    }
                    throw alreadyInMatch(existing);
                }
                Room r = new Room(generateCode(), RoomStatus.WAITING);
                r.getPlayers().add(new Player(u.getId(), u.getUsername(), u.getRating()));
                return rooms.save(r);
            });
        }
        return view(room);
    }

    public Map<String, Object> joinRoom(String rawCode, long userId) {
        String code = normalize(rawCode);
        Object[] out;
        synchronized (lock) {
            out = tx.execute(st -> {
                User u = requireUser(userId);
                Room r = rooms.findByCode(code).orElseThrow(() -> new ApiException(404, "Room not found"));
                if (r.findPlayer(userId) != null) {
                    return new Object[]{r, Boolean.FALSE};
                }
                ensureNotBanned(u);
                List<Room> active = rooms.findActiveForUser(userId, ACTIVE);
                if (!active.isEmpty()) {
                    throw alreadyInMatch(active.get(0));
                }
                if (r.getRoomStatus() != RoomStatus.WAITING) {
                    throw new ApiException(409, "This room is no longer accepting players");
                }
                if (r.getPlayers().size() >= 2) {
                    throw new ApiException(409, "Room is full");
                }
                r.getPlayers().add(new Player(u.getId(), u.getUsername(), u.getRating()));
                if (r.getPlayers().size() == 2) {
                    r.setRoomStatus(RoomStatus.READY);
                    r.setAssignedAt(Instant.now());
                }
                return new Object[]{rooms.save(r), Boolean.TRUE};
            });
        }
        Room room = (Room) out[0];
        if ((Boolean) out[1]) {
            broadcast(room.getCode(), "PLAYER_JOINED");
        }
        return view(room);
    }

    public Map<String, Object> ready(String rawCode, long userId) {
        String code = normalize(rawCode);
        Object[] out;
        synchronized (lock) {
            out = tx.execute(st -> {
                Room r = rooms.findByCode(code).orElseThrow(() -> new ApiException(404, "Room not found"));
                Player me = r.findPlayer(userId);
                if (me == null) {
                    throw new ApiException(403, "You are not in this room");
                }
                if (r.getRoomStatus() == RoomStatus.PLAYING || r.getRoomStatus() == RoomStatus.FINISHED) {
                    return new Object[]{r, Boolean.FALSE};
                }
                if (r.getRoomStatus() != RoomStatus.READY) {
                    throw new ApiException(409, "Waiting for an opponent");
                }
                me.setReady(true);
                boolean all = r.getPlayers().size() == 2;
                for (Player p : r.getPlayers()) {
                    all = all && p.isReady();
                }
                if (all) {
                    r.setRoomStatus(RoomStatus.PLAYING);
                    r.setStartedAt(Instant.now());
                    r.setMapId(pickMap(r));
                    for (Player p : r.getPlayers()) {
                        users.findById(p.getUserId()).ifPresent(u -> p.setRatingBefore(u.getRating()));
                    }
                }
                return new Object[]{rooms.save(r), all};
            });
        }
        Room room = (Room) out[0];
        if ((Boolean) out[1]) {
            games.startSession(room.getCode());
            broadcast(room.getCode(), "GAME_STARTED");
        } else {
            broadcast(room.getCode(), "PLAYER_READY");
        }
        return view(room);
    }

    /** Map vote in the lobby: allowed until the match starts, can be changed. */
    public Map<String, Object> vote(String rawCode, long userId, Integer mapId) {
        if (mapId != null && (mapId < 0 || mapId >= GameSession.MAP_COUNT)) {
            throw new ApiException(400, "Unknown map");
        }
        String code = normalize(rawCode);
        Room room;
        synchronized (lock) {
            room = tx.execute(st -> {
                Room r = rooms.findByCode(code).orElseThrow(() -> new ApiException(404, "Room not found"));
                Player me = r.findPlayer(userId);
                if (me == null) {
                    throw new ApiException(403, "You are not in this room");
                }
                if (r.getRoomStatus() != RoomStatus.WAITING && r.getRoomStatus() != RoomStatus.READY) {
                    throw new ApiException(409, "The match has already started");
                }
                me.setMapVote(mapId);
                return rooms.save(r);
            });
        }
        broadcast(room.getCode(), "MAP_VOTED");
        return view(room);
    }

    /** Same vote wins; two different votes = coin flip between them; no votes = any map. */
    static int pickMap(Room r) {
        List<Integer> votes = new ArrayList<>();
        for (Player p : r.getPlayers()) {
            if (p.getMapVote() != null) {
                votes.add(p.getMapVote());
            }
        }
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        return votes.isEmpty() ? rnd.nextInt(GameSession.MAP_COUNT) : votes.get(rnd.nextInt(votes.size()));
    }

    /**
     * "Rematch" after a finished match: the first player to ask opens a new private room (friendly, unrated),
     * the rival is told over the game channel and joins the same room when they accept.
     */
    public Map<String, Object> rematch(String rawOldCode, long userId) {
        String oldCode = normalize(rawOldCode);
        Map<String, Object> view;
        boolean created;
        String nickname;
        synchronized (lock) {
            Room old = rooms.findByCode(oldCode).orElseThrow(() -> new ApiException(404, "Match not found"));
            Player me = old.findPlayer(userId);
            if (me == null) {
                throw new ApiException(403, "You did not play in this match");
            }
            if (old.getRoomStatus() != RoomStatus.FINISHED) {
                throw new ApiException(409, "The match is not over yet");
            }
            nickname = me.getNickname();
            Room existing = old.getRematchCode() == null ? null : rooms.findByCode(old.getRematchCode()).orElse(null);
            if (existing != null && (existing.getRoomStatus() == RoomStatus.WAITING || existing.getRoomStatus() == RoomStatus.READY)) {
                view = joinRoom(existing.getCode(), userId);
                created = false;
            } else {
                view = createRoom(userId);
                String newCode = (String) view.get("code");
                tx.executeWithoutResult(st -> rooms.findByCode(oldCode).ifPresent(r -> {
                    r.setRematchCode(newCode);
                    rooms.save(r);
                }));
                created = true;
            }
        }
        if (created) {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "REMATCH");
            msg.put("userId", userId);
            msg.put("sender", nickname);
            msg.put("code", view.get("code"));
            messaging.convertAndSend("/topic/room/" + oldCode + "/game", (Object) msg);
        }
        return view;
    }

    public void leave(String rawCode, long userId) {
        String code = normalize(rawCode);
        boolean closed;
        synchronized (lock) {
            closed = tx.execute(st -> {
                Room r = rooms.findByCode(code).orElse(null);
                if (r == null || r.findPlayer(userId) == null) {
                    return false;
                }
                if (r.getRoomStatus() == RoomStatus.PLAYING) {
                    throw new ApiException(409, "The match is already running");
                }
                if (r.getRoomStatus() == RoomStatus.FINISHED) {
                    return false;
                }
                r.getPlayers().removeIf(p -> p.getUserId() != null && p.getUserId() == userId);
                if (r.getPlayers().isEmpty()) {
                    rooms.delete(r);
                    return true;
                }
                r.setRoomStatus(RoomStatus.WAITING);
                r.setAssignedAt(null);
                for (Player p : r.getPlayers()) {
                    p.setReady(false);
                }
                rooms.save(r);
                return false;
            });
        }
        broadcast(code, closed ? "ROOM_CLOSED" : "PLAYER_LEFT");
    }

    public String createMatchedRoom(long userA, long userB) {
        Room room;
        synchronized (lock) {
            room = tx.execute(st -> {
                User a = requireUser(userA);
                User b = requireUser(userB);
                Room r = new Room(generateCode(), RoomStatus.READY);
                r.setRanked(true);
                r.setAssignedAt(Instant.now());
                r.getPlayers().add(new Player(a.getId(), a.getUsername(), a.getRating()));
                r.getPlayers().add(new Player(b.getId(), b.getUsername(), b.getRating()));
                return rooms.save(r);
            });
        }
        return room.getCode();
    }

    /** US-32/34/35: whoever does not enter an assigned match within five minutes is banned and loses. */
    public void sweepAssignments() {
        Instant limit = Instant.now().minusSeconds(joinWindowSeconds);
        for (Room r : rooms.findByRoomStatusIn(List.of(RoomStatus.READY))) {
            if (r.getAssignedAt() == null || r.getAssignedAt().isAfter(limit)) {
                continue;
            }
            List<Long> absent = new ArrayList<>();
            Long present = null;
            for (Player p : r.getPlayers()) {
                if (p.isReady()) {
                    present = p.getUserId();
                } else {
                    absent.add(p.getUserId());
                }
            }
            try {
                // absence bans and rating only for the ranked queue; a private room just closes
                List<Long> banned = r.isRanked() ? absent : List.of();
                if (absent.size() >= 2 || present == null) {
                    results.finalizeMatch(r.getCode(), null, "VOID", banned, false);
                } else {
                    results.finalizeMatch(r.getCode(), present, "NO_SHOW", banned, r.isRanked());
                }
                broadcast(r.getCode(), "MATCH_CANCELLED");
            } catch (RuntimeException e) {
                log.error("Could not resolve no-show for room {}", r.getCode(), e);
            }
        }
        for (Room r : rooms.findByRoomStatusIn(List.of(RoomStatus.PLAYING))) {
            try {
                games.startSession(r.getCode());
            } catch (RuntimeException e) {
                log.error("Could not start session for {}", r.getCode(), e);
            }
        }
    }

    public void cleanupStale() {
        synchronized (lock) {
            tx.executeWithoutResult(st -> {
                Instant before = Instant.now().minus(Duration.ofMinutes(staleWaitingMinutes));
                for (Room r : rooms.findByRoomStatusAndCreatedAtBefore(RoomStatus.WAITING, before)) {
                    rooms.delete(r);
                }
            });
        }
    }

    private User requireUser(long userId) {
        return users.findById(userId).orElseThrow(() -> new ApiException(401, "Please log in again"));
    }

    public static void ensureNotBanned(User u) {
        if (u.isBanned()) {
            long minutes = Math.max(1, Duration.between(Instant.now(), u.getBannedUntil()).toMinutes() + 1);
            throw new ApiException(403, "You are banned from matches for " + minutes + " more minute(s) because of an absence")
                    .with("bannedUntil", u.getBannedUntil().toEpochMilli());
        }
    }

    private static ApiException alreadyInMatch(Room existing) {
        return new ApiException(409, "You are already in a match (" + existing.getCode() + ")")
                .with("roomCode", existing.getCode());
    }

    private String generateCode() {
        for (int i = 0; i < 20; i++) {
            String code = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
            if (!rooms.existsByCode(code)) {
                return code;
            }
        }
        throw new ApiException(500, "Could not create a room, please try again");
    }

    private static String normalize(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }

    private void broadcast(String code, String type) {
        Map<String, Object> msg = new LinkedHashMap<>();
        msg.put("type", type);
        messaging.convertAndSend("/topic/room/" + code, (Object) msg);
    }

    public Map<String, Object> view(Room r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("code", r.getCode());
        m.put("roomStatus", r.getRoomStatus().name());
        m.put("status", r.getRoomStatus().name());
        m.put("ranked", r.isRanked());
        List<Map<String, Object>> ps = new ArrayList<>();
        for (Player p : r.getPlayers()) {
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("id", p.getId());
            pm.put("userId", p.getUserId());
            pm.put("nickname", p.getNickname());
            pm.put("ready", p.isReady());
            pm.put("rating", p.getRatingBefore());
            pm.put("mapVote", p.getMapVote());
            ps.add(pm);
        }
        m.put("players", ps);
        m.put("mapId", r.getMapId());
        m.put("rematchCode", r.getRematchCode());
        Long deadline = null;
        if (r.getRoomStatus() == RoomStatus.READY && r.getAssignedAt() != null) {
            deadline = r.getAssignedAt().plusSeconds(joinWindowSeconds).toEpochMilli();
        }
        m.put("joinDeadline", deadline);
        m.put("serverTime", System.currentTimeMillis());
        return m;
    }
}
