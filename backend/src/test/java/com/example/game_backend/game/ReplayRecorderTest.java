package com.example.game_backend.game;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReplayRecorderTest {
    private static GameSession session(long start) {
        List<GameSession.Snap> snaps = List.of(
                new GameSession.Snap(1, "GATE // A", "Write a", "", "", "solve", "", "", "[]", "EASY"),
                new GameSession.Snap(2, "GATE // B", "Write b", "", "", "solve", "", "", "[]", "MEDIUM"),
                new GameSession.Snap(3, "GATE // C", "Write c", "", "", "solve", "", "", "[]", "MEDIUM"),
                new GameSession.Snap(4, "GATE // D", "Write d", "", "", "solve", "", "", "[]", "HARD"));
        GameSession.Slot[] slots = {new GameSession.Slot(1L, "ann", 1500, start), new GameSession.Slot(2L, "bob", 1500, start)};
        return new GameSession("ABC123", 2, true, start, snaps, slots);
    }

    @Test
    @SuppressWarnings("unchecked")
    void samplesPositionsAndKeepsSolutions() {
        long t0 = 1_000_000;
        GameSession s = session(t0);
        ReplayRecorder r = s.replay;
        r.position(1, 10, 5, t0);
        r.position(1, 11, 5, t0 + 50);   // too soon: skipped
        r.position(1, 12, 5, t0 + 200);
        r.position(1, 12, 5, t0 + 400);  // did not move: skipped
        r.event(1, "OPEN", 1, null, t0 + 500);
        for (int i = 0; i < 25; i++) {
            r.attempt(1, 1, "class Solution { /* try " + i + " */ }", false, 1, 3, t0 + 600 + i);
        }
        r.attempt(1, 1, "class Solution { /* right */ }", true, 3, 3, t0 + 700);
        r.event(1, "UNLOCK", 1, "SOLVED", t0 + 700);

        Map<String, Object> snap = r.snapshot(s, Map.of("winnerUserId", 1));
        List<Map<String, Object>> players = (List<Map<String, Object>>) snap.get("players");
        assertEquals(List.of(0, 100, 50, 200, 120, 50), players.get(0).get("track"));
        assertEquals(List.of(), players.get(1).get("track"));

        List<Map<String, Object>> doors = (List<Map<String, Object>>) snap.get("doors");
        assertEquals(4, doors.size());
        assertEquals("GATE // A", doors.get(0).get("title"));
        List<Map<String, Object>> tries = (List<Map<String, Object>>) ((Map<String, Object>) doors.get(0).get("attempts")).get("1");
        assertEquals(ReplayRecorder.MAX_ATTEMPTS, tries.size(), "only the last attempts are kept");
        assertEquals(true, tries.get(tries.size() - 1).get("passed"), "the accepted solution is always kept");
        assertTrue(((List<?>) snap.get("events")).size() == 2);
        assertEquals(2, snap.get("mapId"));
    }
}
