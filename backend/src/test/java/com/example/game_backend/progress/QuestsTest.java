package com.example.game_backend.progress;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QuestsTest {
    @Test
    void threeQuestsOfDifferentKindsTheSameAllDay() {
        Set<String> seen = new HashSet<>();
        LocalDate day = LocalDate.of(2026, 11, 17);
        for (long user = 1; user <= 200; user++) {
            for (int d = 0; d < 7; d++) {
                List<Quests.Def> a = Quests.forDay(user, day.plusDays(d));
                assertEquals(Quests.PER_DAY, a.size());
                assertEquals(Quests.PER_DAY, a.stream().map(Quests.Def::kind).distinct().count());
                assertEquals(a, Quests.forDay(user, day.plusDays(d)), "must not change during the day");
                a.forEach(q -> seen.add(q.code()));
            }
        }
        // over many players and days every quest shows up
        int all = Quests.GROUPS.stream().mapToInt(List::size).sum();
        assertEquals(all, seen.size());
    }

    @Test
    void seasonRewards() {
        assertEquals(1000, SeasonService.rewardFor(1));
        assertEquals(700, SeasonService.rewardFor(2));
        assertEquals(500, SeasonService.rewardFor(3));
        assertEquals(200, SeasonService.rewardFor(4));
        assertEquals(200, SeasonService.rewardFor(10));
        assertTrue(Achievements.ALL.stream().map(Achievements.Def::code).distinct().count() == Achievements.ALL.size());
    }
}
