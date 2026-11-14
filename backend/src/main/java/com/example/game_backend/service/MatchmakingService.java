package com.example.game_backend.service;

import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.RoomStatus;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.RoomRepository;
import com.example.game_backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Ranked queue (US-09, US-10): pairs players of similar rating; the allowed gap grows while waiting. */
@Service
public class MatchmakingService {
    private static final Logger log = LoggerFactory.getLogger(MatchmakingService.class);
    private static final long STALE_POLL_MS = 90_000L;
    private static final long MATCHED_KEEP_MS = 120_000L;
    private static final List<RoomStatus> ACTIVE = List.of(RoomStatus.WAITING, RoomStatus.READY, RoomStatus.PLAYING);

    private static class Entry {
        final long userId;
        final int rating;
        final long joinedAt;
        long lastPoll;

        Entry(long userId, int rating, long now) {
            this.userId = userId;
            this.rating = rating;
            this.joinedAt = now;
            this.lastPoll = now;
        }
    }

    private static class Assignment {
        final String code;
        final long at;

        Assignment(String code, long at) {
            this.code = code;
            this.at = at;
        }
    }

    private final Map<Long, Entry> queue = new LinkedHashMap<>();
    private final Map<Long, Assignment> matched = new LinkedHashMap<>();
    private final UserRepository users;
    private final RoomRepository rooms;
    private final RoomService roomService;

    public MatchmakingService(UserRepository users, RoomRepository rooms, RoomService roomService) {
        this.users = users;
        this.rooms = rooms;
        this.roomService = roomService;
    }

    public Map<String, Object> join(long userId) {
        User u = users.findById(userId).orElseThrow(() -> new ApiException(401, "Please log in again"));
        RoomService.ensureNotBanned(u);
        synchronized (queue) {
            List<Room> active = rooms.findActiveForUser(userId, ACTIVE);
            // A lonely private room that is still waiting for an opponent must not trap the player: drop it.
            for (Room r : active) {
                if (r.getRoomStatus() == RoomStatus.WAITING) {
                    try {
                        roomService.leave(r.getCode(), userId);
                    } catch (RuntimeException ex) {
                        log.warn("Could not leave waiting room {}", r.getCode(), ex);
                    }
                }
            }
            active = rooms.findActiveForUser(userId, ACTIVE);
            if (!active.isEmpty()) {
                queue.remove(userId);
                matched.put(userId, new Assignment(active.get(0).getCode(), System.currentTimeMillis()));
                return statusLocked(userId);
            }
            matched.remove(userId);
            if (!queue.containsKey(userId)) {
                queue.put(userId, new Entry(userId, u.getRating(), System.currentTimeMillis()));
            }
            return statusLocked(userId);
        }
    }

    public Map<String, Object> status(long userId) {
        synchronized (queue) {
            Entry e = queue.get(userId);
            if (e != null) {
                e.lastPoll = System.currentTimeMillis();
            }
            return statusLocked(userId);
        }
    }

    public int queueSize() {
        synchronized (queue) {
            return queue.size();
        }
    }

    public Map<String, Object> cancel(long userId) {
        synchronized (queue) {
            queue.remove(userId);
            matched.remove(userId);
            return statusLocked(userId);
        }
    }

    private Map<String, Object> statusLocked(long userId) {
        Map<String, Object> m = new LinkedHashMap<>();
        Assignment a = matched.get(userId);
        if (a != null) {
            Room room = rooms.findByCode(a.code).orElse(null);
            if (room == null || !ACTIVE.contains(room.getRoomStatus()) || room.findPlayer(userId) == null) {
                matched.remove(userId);
                a = null;
            }
        }
        Entry e = queue.get(userId);
        if (a != null) {
            m.put("state", "MATCHED");
            m.put("roomCode", a.code);
        } else if (e != null) {
            m.put("state", "SEARCHING");
            m.put("waitedSeconds", (System.currentTimeMillis() - e.joinedAt) / 1000);
        } else {
            m.put("state", "IDLE");
        }
        m.put("playersInQueue", queue.size());
        return m;
    }

    public void pair() {
        synchronized (queue) {
            long now = System.currentTimeMillis();
            queue.values().removeIf(e -> now - e.lastPoll > STALE_POLL_MS);
            matched.values().removeIf(a -> now - a.at > MATCHED_KEEP_MS);

            List<Entry> list = new ArrayList<>(queue.values());
            Set<Long> taken = new HashSet<>();
            for (int i = 0; i < list.size(); i++) {
                Entry a = list.get(i);
                if (taken.contains(a.userId)) {
                    continue;
                }
                Entry best = null;
                int bestDiff = Integer.MAX_VALUE;
                for (int j = i + 1; j < list.size(); j++) {
                    Entry b = list.get(j);
                    if (taken.contains(b.userId)) {
                        continue;
                    }
                    int diff = Math.abs(a.rating - b.rating);
                    long waitedSec = Math.max(now - a.joinedAt, now - b.joinedAt) / 1000;
                    if (diff <= 100 + waitedSec * 25 && diff < bestDiff) {
                        best = b;
                        bestDiff = diff;
                    }
                }
                if (best != null) {
                    try {
                        String code = roomService.createMatchedRoom(a.userId, best.userId);
                        matched.put(a.userId, new Assignment(code, now));
                        matched.put(best.userId, new Assignment(code, now));
                        queue.remove(a.userId);
                        queue.remove(best.userId);
                        taken.add(a.userId);
                        taken.add(best.userId);
                    } catch (RuntimeException ex) {
                        log.error("Could not create a matched room", ex);
                    }
                }
            }
        }
    }
}
