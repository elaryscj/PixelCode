package com.example.game_backend.tournament;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TournamentServiceTest {
    // Almaty is UTC+5: Saturday 2026-11-21 00:00 local = Friday 19:00 UTC
    private final TournamentService t = new TournamentService(null, null, null, null, "Asia/Almaty");
    private static final LocalDate SAT = LocalDate.of(2026, 11, 21);

    @Test
    void weekendRunsFromSaturdayToMondayLocalTime() {
        assertNull(t.weekendOf(Instant.parse("2026-11-20T18:59:59Z")), "Friday 23:59 local is not the weekend");
        assertEquals(SAT, t.weekendOf(Instant.parse("2026-11-20T19:00:00Z")));
        assertEquals(SAT, t.weekendOf(Instant.parse("2026-11-22T18:59:59Z")), "Sunday 23:59 local");
        assertNull(t.weekendOf(Instant.parse("2026-11-22T19:00:00Z")), "Monday 00:00 local");
    }

    @Test
    void currentOrNextAndLastFinished() {
        Instant wednesday = Instant.parse("2026-11-25T10:00:00Z");
        assertEquals(LocalDate.of(2026, 11, 28), t.currentOrNext(wednesday));
        assertEquals(SAT, t.lastFinished(wednesday));
        Instant sunday = Instant.parse("2026-11-22T10:00:00Z");
        assertEquals(SAT, t.currentOrNext(sunday));
        assertEquals(LocalDate.of(2026, 11, 14), t.lastFinished(sunday), "the running weekend is not finished yet");
        Instant mondayMidnight = Instant.parse("2026-11-22T19:00:00Z");
        assertEquals(SAT, t.lastFinished(mondayMidnight));
    }

    @Test
    void points() {
        assertEquals(3, TournamentService.pointsFor("WIN", false));
        assertEquals(1, TournamentService.pointsFor("DRAW", false));
        assertEquals(0, TournamentService.pointsFor("LOSS", false));
        assertEquals(1, TournamentService.pointsFor("WIN", true));
        assertEquals(0, TournamentService.pointsFor("DRAW", true));
    }
}
