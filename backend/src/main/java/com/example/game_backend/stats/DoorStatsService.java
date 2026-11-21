package com.example.game_backend.stats;

import com.example.game_backend.entity.Challenge;
import com.example.game_backend.entity.DoorResult;
import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.ChallengeRepository;
import com.example.game_backend.repository.DoorResultRepository;
import com.example.game_backend.repository.RoomRepository;
import com.example.game_backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Door outcomes of every match. The game records them inside its session lock, so they are only queued
 * there and written by the scheduler a moment later (no database wait while both players are locked).
 */
@Service
public class DoorStatsService {
    private static final Logger log = LoggerFactory.getLogger(DoorStatsService.class);
    private static final int TOP = 5;

    private final ConcurrentLinkedQueue<DoorResult> pending = new ConcurrentLinkedQueue<>();
    private final DoorResultRepository results;
    private final ChallengeRepository challenges;
    private final RoomRepository rooms;
    private final UserRepository users;

    public DoorStatsService(DoorResultRepository results, ChallengeRepository challenges, RoomRepository rooms,
                            UserRepository users) {
        this.results = results;
        this.challenges = challenges;
        this.rooms = rooms;
        this.users = users;
    }

    public void enqueue(DoorResult r) {
        pending.add(r);
    }

    /** Called every second by the scheduler. */
    public void flush() {
        List<DoorResult> batch = new ArrayList<>();
        DoorResult r;
        while ((r = pending.poll()) != null) {
            batch.add(r);
        }
        if (batch.isEmpty()) {
            return;
        }
        try {
            results.saveAll(batch);
        } catch (RuntimeException e) {
            log.error("Could not save {} door results", batch.size(), e);
        }
    }

    // ------------------------------------------------------------------ admin STATS

    /**
     * Per challenge: how often it was met, solved by code, opened by the timer, attempts and time. A hint
     * flags challenges whose real solve rate does not fit their difficulty.
     */
    public Map<String, Object> adminStats(int days) {
        Instant since = Instant.now().minus(Duration.ofDays(Math.max(1, Math.min(days, 3650))));
        Map<Long, Map<String, Object>> rows = new LinkedHashMap<>();
        Map<Long, Challenge> byId = new HashMap<>();
        for (Challenge c : challenges.findAllByOrderByIdDesc()) {
            if (c.getOwnerId() == null) {
                byId.put(c.getId(), c);
            }
        }
        for (Object[] a : results.summary(since)) {
            long cid = ((Number) a[0]).longValue();
            Challenge c = byId.get(cid);
            if (c == null) {
                continue; // a teacher's private task (lessons are not counted) or a deleted one
            }
            String outcome = (String) a[1];
            long n = ((Number) a[2]).longValue();
            double attempts = a[3] == null ? 0 : ((Number) a[3]).doubleValue();
            double seconds = a[4] == null ? 0 : ((Number) a[4]).doubleValue();
            Map<String, Object> row = rows.computeIfAbsent(cid, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("challengeId", cid);
                m.put("title", c.getTitle());
                m.put("difficulty", c.getDifficulty());
                m.put("published", c.isPublished());
                m.put("met", 0L);
                m.put("solved", 0L);
                m.put("timeout", 0L);
                m.put("unsolved", 0L);
                m.put("attemptsSum", 0.0);
                m.put("solveSecondsSum", 0.0);
                return m;
            });
            row.put("met", (Long) row.get("met") + n);
            row.put(outcome.toLowerCase(), (Long) row.getOrDefault(outcome.toLowerCase(), 0L) + n);
            row.put("attemptsSum", (Double) row.get("attemptsSum") + attempts * n);
            if (DoorResult.SOLVED.equals(outcome)) {
                row.put("solveSecondsSum", seconds * n);
            }
        }
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> row : rows.values()) {
            long met = (Long) row.get("met");
            long solved = (Long) row.get("solved");
            double rate = met == 0 ? 0 : (double) solved / met;
            row.put("solveRate", Math.round(rate * 1000) / 10.0);
            row.put("avgAttempts", Math.round((Double) row.remove("attemptsSum") / Math.max(1, met) * 10) / 10.0);
            double secSum = (Double) row.remove("solveSecondsSum");
            row.put("avgSolveSeconds", solved == 0 ? null : Math.round(secSum / solved));
            row.put("hint", hint((String) row.get("difficulty"), rate, met));
            list.add(row);
        }
        list.sort((x, y) -> Long.compare((Long) y.get("met"), (Long) x.get("met")));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("days", days);
        out.put("challenges", list);
        out.put("matches", matchSummary(since));
        return out;
    }

    /** Below these solve rates a level is "too hard", above the next ones "too easy" (needs 5+ meetings). */
    static String hint(String difficulty, double rate, long met) {
        if (met < 5) {
            return "FEW_DATA";
        }
        double low, high;
        switch (difficulty == null ? "EASY" : difficulty) {
            case "HARD" -> { low = 0.25; high = 0.85; }
            case "MEDIUM" -> { low = 0.40; high = 0.92; }
            default -> { low = 0.60; high = 1.01; }
        }
        if (rate < low) {
            return "TOO_HARD";
        }
        if (rate > high) {
            return "TOO_EASY";
        }
        return "OK";
    }

    private Map<String, Object> matchSummary(Instant since) {
        long total = 0, bot = 0, ranked = 0, friendly = 0, durationSum = 0, durationN = 0;
        Map<String, Long> reasons = new LinkedHashMap<>();
        Set<Long> players = new HashSet<>();
        for (Room r : rooms.findFinishedSince(since)) {
            total++;
            if (r.isBotMatch()) {
                bot++;
            } else if (r.isRanked()) {
                ranked++;
            } else {
                friendly++;
            }
            String reason = r.getResultReason() == null ? "?" : r.getResultReason();
            reasons.merge(reason, 1L, Long::sum);
            if (r.getDurationSeconds() != null && !"VOID".equals(reason) && !"NO_SHOW".equals(reason)) {
                durationSum += r.getDurationSeconds();
                durationN++;
            }
            r.getPlayers().forEach(p -> {
                if (p.getUserId() != null) {
                    players.add(p.getUserId());
                }
            });
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", total);
        m.put("ranked", ranked);
        m.put("bot", bot);
        m.put("friendly", friendly);
        m.put("players", players.size());
        m.put("avgDurationSeconds", durationN == 0 ? null : durationSum / durationN);
        m.put("reasons", reasons);
        return m;
    }

    // ------------------------------------------------------------------ best solutions

    /** Doors of one match that this player reached, with their challenge ids (for the result screen). */
    public List<Map<String, Object>> doorsOfMatch(String roomCode, long userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (DoorResult d : results.findByRoomCodeAndUserIdOrderByIdAsc(roomCode, userId)) {
            if (!seen.add(d.getChallengeId())) {
                continue;
            }
            Challenge c = challenges.findById(d.getChallengeId()).orElse(null);
            if (c == null) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("challengeId", c.getId());
            m.put("title", c.getTitle());
            m.put("difficulty", c.getDifficulty());
            m.put("outcome", d.getOutcome());
            out.add(m);
        }
        return out;
    }

    /**
     * Shortest and fastest accepted solutions of a challenge (one per player). Only for players who have met
     * that challenge in a match, so the page cannot be used to look up answers before a door.
     */
    public Map<String, Object> bestSolutions(long challengeId, long userId) {
        Challenge c = challenges.findById(challengeId).orElseThrow(() -> new ApiException(404, "Challenge not found"));
        if (!results.existsByChallengeIdAndUserId(challengeId, userId)) {
            throw new ApiException(403, "Meet this challenge in a match first");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("challengeId", c.getId());
        out.put("title", c.getTitle());
        out.put("difficulty", c.getDifficulty());
        out.put("description", c.getDescription());
        out.put("inputDescription", c.getInputDescription());
        out.put("outputDescription", c.getOutputDescription());
        out.put("shortest", top(results.shortest(challengeId, PageRequest.of(0, 60))));
        out.put("fastest", top(results.fastest(challengeId, PageRequest.of(0, 60))));
        Map<String, Object> mine = null;
        for (DoorResult d : results.findByChallengeIdAndUserIdOrderByIdDesc(challengeId, userId)) {
            if (mine == null || DoorResult.SOLVED.equals(d.getOutcome())) {
                mine = view(d, null);
                if (DoorResult.SOLVED.equals(d.getOutcome())) {
                    break; // the latest accepted one
                }
            }
        }
        out.put("mine", mine);
        return out;
    }

    private List<Map<String, Object>> top(List<DoorResult> sorted) {
        List<Map<String, Object>> out = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        Map<Long, String> names = new HashMap<>();
        for (DoorResult d : sorted) {
            if (out.size() >= TOP || !seen.add(d.getUserId())) {
                continue;
            }
            String name = names.computeIfAbsent(d.getUserId(),
                    id -> users.findById(id).map(User::getUsername).orElse("?"));
            out.add(view(d, name));
        }
        return out;
    }

    private static Map<String, Object> view(DoorResult d, String name) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (name != null) {
            m.put("userId", d.getUserId());
            m.put("nickname", name);
        }
        m.put("outcome", d.getOutcome());
        m.put("seconds", d.getSeconds());
        m.put("attempts", d.getAttempts());
        m.put("chars", d.getSourceChars());
        m.put("source", d.getSource());
        m.put("at", d.getCreatedAt().toString());
        return m;
    }
}
