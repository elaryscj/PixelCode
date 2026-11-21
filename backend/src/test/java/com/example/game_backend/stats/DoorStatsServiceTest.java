package com.example.game_backend.stats;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DoorStatsServiceTest {
    @Test
    void hintComparesSolveRateWithTheLevel() {
        assertEquals("FEW_DATA", DoorStatsService.hint("EASY", 0.1, 4));
        assertEquals("TOO_HARD", DoorStatsService.hint("EASY", 0.5, 10));
        assertEquals("OK", DoorStatsService.hint("EASY", 1.0, 10), "an EASY door everyone solves is fine");
        assertEquals("TOO_EASY", DoorStatsService.hint("HARD", 0.9, 10));
        assertEquals("OK", DoorStatsService.hint("MEDIUM", 0.6, 10));
        assertEquals("TOO_HARD", DoorStatsService.hint("HARD", 0.2, 10));
    }
}
