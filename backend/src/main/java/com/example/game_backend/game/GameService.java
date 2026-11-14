package com.example.game_backend.game;

import com.example.game_backend.entity.Challenge;
import com.example.game_backend.entity.Player;
import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.RoomStatus;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.ChallengeRepository;
import com.example.game_backend.repository.RoomRepository;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Server-authoritative match logic: door timers (US-20/21), verified solutions (US-17/18/19),
 * first valid finish (US-15), absence handling (US-33/34/35), time limit.
 */
@Service
public class GameService {
    private static final Logger log = LoggerFactory.getLogger(GameService.class);
    private static final int MAX_SOURCE_CHARS = 20000;
    private static final long KEEP_FINISHED_MS = 10 * 60_000L;
    private static final long CONNECTED_MS = 10_000L;
    /**
     * Fastest legal motion in units/second (see reportPosition): sideways = running on ice plus a belt or a
     * moving block (~50); up = bounce pad (~93); down = a fall from the top (~156). A little headroom on each.
     */
    private static final double SPEED_X = 70;
    private static final double SPEED_UP = 100;
    private static final double SPEED_DOWN = 170;
    /** the budget holds at most this much movement, so idling or flooding messages buys no teleport */
    private static final double BUDGET_SECONDS = 0.5;
    private static final double SLACK = 4;
    private static final double CAP_X = SPEED_X * BUDGET_SECONDS + SLACK;
    private static final double CAP_UP = SPEED_UP * BUDGET_SECONDS + SLACK;
    private static final double CAP_DOWN = SPEED_DOWN * BUDGET_SECONDS + SLACK;

    private final Map<String, GameSession> sessions = new ConcurrentHashMap<>();
    private final RoomRepository rooms;
    private final UserRepository users;
    private final ChallengeRepository challenges;
    private final MatchResultService results;
    private final ChallengeEvaluator evaluator;
    private final SimpMessagingTemplate messaging;
    private final TokenService tokens;

    private final long doorMs;
    private final long maxMatchMs;
    private final long absenceMs;
    private final long minSubmitGapMs;

    public GameService(RoomRepository rooms, UserRepository users, ChallengeRepository challenges, MatchResultService results,
                       ChallengeEvaluator evaluator, SimpMessagingTemplate messaging, TokenService tokens,
                       @Value("${game.door-seconds:240}") long doorSeconds,
                       @Value("${game.max-match-minutes:20}") long maxMatchMinutes,
                       @Value("${game.absence-seconds:300}") long absenceSeconds,
                       @Value("${game.min-submit-gap-ms:1000}") long minSubmitGapMs) {
        this.rooms = rooms;
        this.users = users;
        this.challenges = challenges;
        this.results = results;
        this.evaluator = evaluator;
        this.messaging = messaging;
        this.tokens = tokens;
        this.doorMs = doorSeconds * 1000L;
        this.maxMatchMs = maxMatchMinutes * 60_000L;
        this.absenceMs = absenceSeconds * 1000L;
        this.minSubmitGapMs = minSubmitGapMs;
    }

    // ---------------------------------------------------------------- sessions

    private synchronized GameSession session(String code) {
        GameSession s = sessions.get(code);
        if (s != null) {
            return s;
        }
        Room room = rooms.findByCode(code).orElseThrow(() -> new ApiException(404, "Match not found"));
        if (room.getRoomStatus() != RoomStatus.PLAYING) {
            return null;
        }
        s = build(room);
        sessions.put(code, s);
        return s;
    }

    /** Creates the running session for a room that has just started (idempotent). */
    public void startSession(String code) {
        session(code);
    }

    private GameSession build(Room room) {
        List<Challenge> pool = new ArrayList<>(challenges.findByPublishedTrueAndDifficulty("EASY"));
        if (pool.isEmpty()) {
            throw new ApiException(503, "No challenges are published yet");
        }
        Collections.shuffle(pool);
        List<GameSession.Snap> snaps = new ArrayList<>();
        for (int i = 0; i < GameSession.DOORS; i++) {
            Challenge c = pool.get(i % pool.size());
            snaps.add(new GameSession.Snap(c.getId(), c.getTitle(), c.getDescription(), c.getInputDescription(),
                    c.getOutputDescription(), c.getFunctionName(), c.getStarterCode(), c.getExamples(), c.getTestsJson()));
        }
        long now = System.currentTimeMillis();
        long started = room.getStartedAt() != null ? room.getStartedAt().toEpochMilli() : now;
        GameSession.Slot[] slots = new GameSession.Slot[room.getPlayers().size()];
        for (int i = 0; i < slots.length; i++) {
            Player p = room.getPlayers().get(i);
            slots[i] = new GameSession.Slot(p.getUserId(), p.getNickname(),
                    p.getRatingBefore() == null ? 1500 : p.getRatingBefore(), now);
            final GameSession.Slot slot = slots[i];
            users.findById(p.getUserId()).ifPresent(u -> slot.skin = u.getActiveSkin());
        }
        // rooms started before map voting existed have no map stored: derive a stable one from the code
        int mapId = room.getMapId() != null ? room.getMapId() : Math.floorMod(room.getCode().hashCode(), GameSession.MAP_COUNT);
        MapGeometry.Arena arena = MapGeometry.of(mapId);
        for (GameSession.Slot slot : slots) {
            slot.x = arena.startX();
            slot.y = arena.startY();
            slot.posAt = now;
            slot.lastReportAt = now;
            slot.budgetX = CAP_X;
            slot.budgetUp = CAP_UP;
            slot.budgetDown = CAP_DOWN;
            slot.markVisited(slot.x, slot.y);
        }
        return new GameSession(room.getCode(), mapId, room.isRanked(), started, snaps, slots);
    }

    private GameSession activeSession(String code) {
        GameSession s = session(code);
        if (s == null) {
            throw new ApiException(409, "This match is not active");
        }
        return s;
    }

    private GameSession.Slot requireSlot(GameSession s, long userId) {
        GameSession.Slot me = s.slot(userId);
        if (me == null) {
            throw new ApiException(403, "You are not a player in this match");
        }
        return me;
    }

    private static void checkDoor(int cp) {
        if (cp < 1 || cp > GameSession.DOORS) {
            throw new ApiException(400, "Unknown door");
        }
    }

    // ---------------------------------------------------------------- state

    /** Full match state; also restores a player after reconnecting (US-33). */
    public Map<String, Object> state(String code, long userId) {
        GameSession s = session(code);
        if (s == null) {
            Room room = rooms.findByCode(code).orElseThrow(() -> new ApiException(404, "Match not found"));
            if (room.findPlayer(userId) == null) {
                throw new ApiException(403, "You are not a player in this match");
            }
            if (room.getRoomStatus() == RoomStatus.FINISHED) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("status", "FINISHED");
                m.put("result", ResultViews.of(room));
                return m;
            }
            throw new ApiException(409, "This match has not started yet");
        }
        GameSession.Slot me = requireSlot(s, userId);
        long now = System.currentTimeMillis();
        synchronized (s) {
            if (!s.over) {
                me.lastSeen = now;
            }
            GameSession.Slot opp = s.other(userId);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("status", s.over ? "FINISHED" : "PLAYING");
            m.put("serverTime", now);
            m.put("elapsedSeconds", Math.max(0, (now - s.startedAt) / 1000));
            m.put("maxSeconds", maxMatchMs / 1000);
            m.put("doorSeconds", doorMs / 1000);
            m.put("mapId", s.mapId);
            m.put("me", slotView(me, now, true));
            m.put("opponent", opp == null ? null : slotView(opp, now, true));
            List<String> titles = new ArrayList<>();
            for (GameSession.Snap sn : s.challenges) {
                titles.add(sn.title);
            }
            m.put("doorTitles", titles);
            m.put("result", s.over ? s.result : null);
            return m;
        }
    }

    private Map<String, Object> slotView(GameSession.Slot slot, long now, boolean withDoors) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", slot.userId);
        m.put("nickname", slot.nickname);
        m.put("rating", slot.rating);
        m.put("skin", slot.skin);
        List<Integer> unlocked = new ArrayList<>();
        for (int i = 1; i <= GameSession.DOORS; i++) {
            if (slot.unlocked[i]) {
                unlocked.add(i);
            }
        }
        m.put("unlocked", unlocked);
        m.put("connected", now - slot.lastSeen < CONNECTED_MS);
        m.put("x", slot.x);
        m.put("y", slot.y);
        if (withDoors) {
            Map<String, Object> doors = new LinkedHashMap<>();
            for (int i = 1; i <= GameSession.DOORS; i++) {
                if (!slot.unlocked[i] && slot.doorStartedAt[i] > 0) {
                    doors.put(String.valueOf(i), secondsLeft(slot, i, now));
                }
            }
            m.put("doors", doors);
        }
        return m;
    }

    private long secondsLeft(GameSession.Slot slot, int cp, long now) {
        long left = doorMs - (now - slot.doorStartedAt[cp]);
        return Math.max(0, (left + 999) / 1000);
    }

    // ---------------------------------------------------------------- doors

    /** US-16: shows the challenge and starts the never-resetting door timer. */
    public Map<String, Object> openDoor(String code, long userId, int cp, Double x, Double y) {
        checkDoor(cp);
        GameSession s = activeSession(code);
        GameSession.Slot me = requireSlot(s, userId);
        long now = System.currentTimeMillis();
        synchronized (s) {
            if (s.over) {
                throw new ApiException(409, "The match is over");
            }
            if (me.unlocked[cp]) {
                throw new ApiException(409, "This door is already open");
            }
            if (cp > 1 && !me.unlocked[cp - 1]) {
                throw new ApiException(409, "Open the previous door first");
            }
            reportPosition(s, me, x, y, now);
            if (!MapGeometry.nearDoor(MapGeometry.of(s.mapId), cp, me.x, me.y)) {
                throw new ApiException(409, "Walk up to the door first");
            }
            me.lastSeen = now;
            if (me.doorStartedAt[cp] == 0) {
                me.doorStartedAt[cp] = now;
            }
            GameSession.Snap sn = s.challenges.get(cp - 1);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("cpNum", cp);
            m.put("title", sn.title);
            m.put("difficulty", "EASY");
            m.put("description", sn.description);
            m.put("inputDescription", sn.inputDescription);
            m.put("outputDescription", sn.outputDescription);
            m.put("functionName", sn.functionName);
            m.put("initialCode", sn.starterCode);
            m.put("examples", sn.examples == null ? new ArrayList<String>() : List.of(sn.examples.split("\n")));
            m.put("secondsRemaining", secondsLeft(me, cp, now));
            m.put("serverTime", now);
            return m;
        }
    }

    /** US-17/18/19: server-side evaluation; a verified solution opens only this player's door. */
    public Map<String, Object> submit(String code, long userId, int cp, String source) {
        checkDoor(cp);
        if (source == null || source.isBlank()) {
            throw new ApiException(400, "Write some code first");
        }
        if (source.length() > MAX_SOURCE_CHARS) {
            throw new ApiException(400, "Solution is too long");
        }
        GameSession s = activeSession(code);
        GameSession.Slot me = requireSlot(s, userId);
        GameSession.Snap sn;
        long now = System.currentTimeMillis();
        synchronized (s) {
            if (s.over) {
                throw new ApiException(409, "The match is over");
            }
            if (me.unlocked[cp]) {
                throw new ApiException(409, "This door is already open");
            }
            if (me.doorStartedAt[cp] == 0) {
                throw new ApiException(409, "Open the door first");
            }
            if (now - me.lastSubmitAt[cp] < minSubmitGapMs) {
                throw new ApiException(429, "Slow down: wait a second between submissions");
            }
            me.lastSubmitAt[cp] = now;
            me.lastSeen = now;
            sn = s.challenges.get(cp - 1);
        }

        EvalResult r = evaluator.evaluate(source, sn.functionName, sn.testsJson);

        synchronized (s) {
            long after = System.currentTimeMillis();
            if (r.passed && !s.over && !me.unlocked[cp]) {
                unlock(s, me, cp, "SOLVED");
            }
            Map<String, Object> m = r.toMap();
            m.put("unlocked", me.unlocked[cp]);
            m.put("matchOver", s.over);
            m.put("secondsRemaining", me.unlocked[cp] ? 0 : secondsLeft(me, cp, after));
            return m;
        }
    }

    private void unlock(GameSession s, GameSession.Slot slot, int cp, String reason) {
        slot.unlocked[cp] = true;
        Map<String, Object> msg = new LinkedHashMap<>();
        msg.put("type", "DOOR_UNLOCKED");
        msg.put("sender", slot.nickname);
        msg.put("userId", slot.userId);
        msg.put("cpNum", cp);
        msg.put("reason", reason);
        emit(s.code, msg);
    }

    // ---------------------------------------------------------------- finish

    /** US-15: first player at the exit with all doors open wins. */
    public Map<String, Object> finish(String code, long userId, Double x, Double y) {
        GameSession s = activeSession(code);
        GameSession.Slot me = requireSlot(s, userId);
        synchronized (s) {
            if (!s.over) {
                if (me.unlockedCount() < GameSession.DOORS) {
                    throw new ApiException(409, "Unlock all doors before reaching the exit");
                }
                reportPosition(s, me, x, y, System.currentTimeMillis());
                if (!MapGeometry.atExit(MapGeometry.of(s.mapId), me.x, me.y)) {
                    throw new ApiException(409, "Reach the exit first");
                }
                conclude(s, me.userId, "FINISH", List.of(), true);
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("status", "FINISHED");
            m.put("result", s.result);
            return m;
        }
    }

    private void conclude(GameSession s, Long winnerUserId, String reason, List<Long> banned, boolean rated) {
        if (s.over) {
            return;
        }
        // private rooms are friendly games: no rating, no PIXELS, no absence bans
        Map<String, Object> result = results.finalizeMatch(s.code, winnerUserId, reason,
                s.ranked ? banned : List.of(), rated && s.ranked);
        s.result = result;
        s.over = true;
        s.overAt = System.currentTimeMillis();
        Map<String, Object> msg = new LinkedHashMap<>();
        msg.put("type", "GAME_OVER");
        msg.put("result", result);
        emit(s.code, msg);
    }

    // ---------------------------------------------------------------- live position

    /** WebSocket: position + heartbeat, relayed to the opponent (US-14). */
    public void onMove(String token, String code, double x, double y) {
        Long uid = tokens.verify(token);
        if (uid == null || code == null) {
            return;
        }
        GameSession s = sessions.get(code);
        if (s == null) {
            return;
        }
        GameSession.Slot me = s.slot(uid);
        if (me == null || !Double.isFinite(x) || !Double.isFinite(y)) {
            return;
        }
        synchronized (s) {
            if (s.over) {
                return;
            }
            long now = System.currentTimeMillis();
            me.lastSeen = now; // still a heartbeat, even when the position itself is refused
            reportPosition(s, me, x, y, now);
        }
    }

    /**
     * Anti-cheat: accepts a reported position only when the player could really have got there - the move fits
     * the movement budget (refilled at the fastest legal speed, holding at most half a second of movement), or it
     * goes back to a spot they already stood in (respawn). Accepted positions are relayed to the opponent; refused
     * ones are dropped and the client catches up on its next reports.
     */
    private void reportPosition(GameSession s, GameSession.Slot me, Double rawX, Double rawY, long now) {
        if (rawX == null || rawY == null || !Double.isFinite(rawX) || !Double.isFinite(rawY)) {
            return;
        }
        double x = Math.max(0, Math.min(100, rawX));
        double y = Math.max(0, Math.min(100, rawY));
        // refill the movement budget for the time since the last report (capped)
        double elapsed = Math.max(0, (now - me.lastReportAt) / 1000.0);
        me.lastReportAt = now;
        me.budgetX = Math.min(CAP_X, me.budgetX + SPEED_X * elapsed);
        me.budgetUp = Math.min(CAP_UP, me.budgetUp + SPEED_UP * elapsed);
        me.budgetDown = Math.min(CAP_DOWN, me.budgetDown + SPEED_DOWN * elapsed);
        double dx = Math.abs(x - me.x);
        double dy = y - me.y;
        boolean reachable = dx <= me.budgetX && (dy >= 0 ? dy <= me.budgetUp : -dy <= me.budgetDown);
        if (reachable) {
            me.budgetX -= dx;
            if (dy >= 0) {
                me.budgetUp -= dy;
            } else {
                me.budgetDown += dy;
            }
        } else if (!me.visited(x, y)) { // a respawn jumps back to a spot the player already passed
            if (++me.rejectedMoves % 50 == 1) {
                log.warn("Refused impossible move of {} in {}: ({},{}) -> ({},{})", me.nickname, s.code,
                        Math.round(me.x), Math.round(me.y), Math.round(x), Math.round(y));
            }
            return;
        }
        if (reachable) {
            me.markPath(me.x, me.y, x, y);
        }
        me.x = x;
        me.y = y;
        me.posAt = now;
        Map<String, Object> msg = new LinkedHashMap<>();
        msg.put("type", "MOVE");
        msg.put("sender", me.nickname);
        msg.put("userId", me.userId);
        msg.put("x", x);
        msg.put("y", y);
        emit(s.code, msg);
    }

    /** Live counters for the "players online" line. */
    public int activeMatches() {
        int n = 0;
        for (GameSession s : sessions.values()) {
            if (!s.over) {
                n++;
            }
        }
        return n;
    }

    // ---------------------------------------------------------------- timers

    public void tick() {
        long now = System.currentTimeMillis();
        for (GameSession s : sessions.values()) {
            try {
                tickSession(s, now);
            } catch (RuntimeException e) {
                log.error("Game tick failed for {}", s.code, e);
            }
        }
    }

    private void tickSession(GameSession s, long now) {
        synchronized (s) {
            if (s.over) {
                if (now - s.overAt > KEEP_FINISHED_MS) {
                    sessions.remove(s.code);
                }
                return;
            }
            // US-21: a door still locked after four minutes opens by itself (only for that player).
            for (GameSession.Slot slot : s.slots) {
                for (int cp = 1; cp <= GameSession.DOORS; cp++) {
                    if (!slot.unlocked[cp] && slot.doorStartedAt[cp] > 0 && now - slot.doorStartedAt[cp] >= doorMs) {
                        unlock(s, slot, cp, "TIMEOUT");
                    }
                }
            }
            // US-33/34/35: five minutes without any sign of life = ban + technical loss.
            List<GameSession.Slot> absent = new ArrayList<>();
            for (GameSession.Slot slot : s.slots) {
                if (now - slot.lastSeen >= absenceMs) {
                    absent.add(slot);
                }
            }
            if (absent.size() >= 2) {
                List<Long> ids = new ArrayList<>();
                for (GameSession.Slot a : absent) {
                    ids.add(a.userId);
                }
                conclude(s, null, "VOID", ids, false);
                return;
            }
            if (absent.size() == 1) {
                GameSession.Slot a = absent.get(0);
                GameSession.Slot winner = s.other(a.userId);
                conclude(s, winner == null ? null : winner.userId, "ABSENCE", List.of(a.userId), true);
                return;
            }
            if (now - s.startedAt >= maxMatchMs && s.slots.length == 2) {
                GameSession.Slot a = s.slots[0];
                GameSession.Slot b = s.slots[1];
                int ca = a.unlockedCount();
                int cb = b.unlockedCount();
                if (ca == cb) {
                    conclude(s, null, "DRAW", List.of(), true);
                } else {
                    conclude(s, ca > cb ? a.userId : b.userId, "TIME_LIMIT", List.of(), true);
                }
            }
        }
    }

    private void emit(String code, Map<String, Object> payload) {
        messaging.convertAndSend("/topic/room/" + code + "/game", (Object) payload);
    }
}
