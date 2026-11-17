package com.example.game_backend.game;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Records one match for the replay: both players' positions over time, door events, quick phrases and every
 * submitted solution. Lives inside the GameSession and is only touched under the session lock. Times are
 * milliseconds since the match started.
 */
public class ReplayRecorder {
    /** a position is kept at most this often per player (and only when it changed) */
    static final long SAMPLE_MS = 150;
    /** solutions kept per player and door (the last ones; the accepted one is always the last) */
    static final int MAX_ATTEMPTS = 20;
    static final int MAX_CODE_CHARS = 20_000;

    private final long startedAt;
    /** userId -> [t, x*10, y*10, t, x*10, y*10, ...] */
    private final Map<Long, List<Integer>> tracks = new LinkedHashMap<>();
    private final Map<Long, Long> lastSample = new HashMap<>();
    private final List<Map<String, Object>> events = new ArrayList<>();
    /** "userId:cp" -> attempts */
    private final Map<String, List<Map<String, Object>>> attempts = new LinkedHashMap<>();

    public ReplayRecorder(long startedAt) {
        this.startedAt = startedAt;
    }

    private int t(long now) {
        return (int) Math.max(0, now - startedAt);
    }

    public void position(long userId, double x, double y, long now) {
        Long last = lastSample.get(userId);
        if (last != null && now - last < SAMPLE_MS) {
            return;
        }
        List<Integer> track = tracks.computeIfAbsent(userId, k -> new ArrayList<>());
        int px = (int) Math.round(x * 10);
        int py = (int) Math.round(y * 10);
        int n = track.size();
        if (n >= 3 && track.get(n - 2) == px && track.get(n - 1) == py) {
            return; // standing still: nothing new
        }
        lastSample.put(userId, now);
        track.add(t(now));
        track.add(px);
        track.add(py);
    }

    public void event(long userId, String type, Integer cp, String detail, long now) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("t", t(now));
        e.put("userId", userId);
        e.put("type", type);
        if (cp != null) {
            e.put("cp", cp);
        }
        if (detail != null) {
            e.put("detail", detail);
        }
        events.add(e);
    }

    public void attempt(long userId, int cp, String source, boolean passed, int passedCount, int total, long now) {
        List<Map<String, Object>> list = attempts.computeIfAbsent(userId + ":" + cp, k -> new ArrayList<>());
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("t", t(now));
        a.put("passed", passed);
        a.put("passedCount", passedCount);
        a.put("total", total);
        a.put("code", source.length() > MAX_CODE_CHARS ? source.substring(0, MAX_CODE_CHARS) : source);
        list.add(a);
        if (list.size() > MAX_ATTEMPTS) {
            list.remove(0);
        }
    }

    /** Everything recorded, plus the match facts the viewer needs. */
    public Map<String, Object> snapshot(GameSession s, Map<String, Object> result) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("version", 1);
        m.put("code", s.code);
        m.put("mapId", s.mapId);
        m.put("startedAt", startedAt);
        m.put("result", result);
        List<Map<String, Object>> players = new ArrayList<>();
        for (GameSession.Slot slot : s.slots) {
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("userId", slot.userId);
            p.put("nickname", slot.nickname);
            p.put("skin", slot.skin);
            p.put("track", tracks.getOrDefault(slot.userId, List.of()));
            players.add(p);
        }
        m.put("players", players);
        List<Map<String, Object>> doors = new ArrayList<>();
        for (int cp = 1; cp <= GameSession.DOORS && cp <= s.challenges.size(); cp++) {
            GameSession.Snap sn = s.challenges.get(cp - 1);
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("cp", cp);
            d.put("title", sn.title);
            d.put("difficulty", sn.difficulty);
            d.put("description", sn.description);
            Map<String, Object> byPlayer = new LinkedHashMap<>();
            for (GameSession.Slot slot : s.slots) {
                byPlayer.put(String.valueOf(slot.userId), attempts.getOrDefault(slot.userId + ":" + cp, List.of()));
            }
            d.put("attempts", byPlayer);
            doors.add(d);
        }
        m.put("doors", doors);
        m.put("events", events);
        return m;
    }
}
