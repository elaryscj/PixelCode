package com.example.game_backend.progress;

import com.example.game_backend.entity.Player;
import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.RoomStatus;
import com.example.game_backend.entity.Season;
import com.example.game_backend.entity.SeasonResult;
import com.example.game_backend.entity.User;
import com.example.game_backend.game.MatchResultService;
import com.example.game_backend.repository.AchievementRepository;
import com.example.game_backend.repository.RoomRepository;
import com.example.game_backend.repository.SeasonRepository;
import com.example.game_backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real PostgreSQL (the separate local test database "pixelcode_test"): a solved door and a ranked win pay
 * achievements and quests exactly once, and closing a season rewards the top and pulls ratings to 1500.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/pixelcode_test",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.limits.register-per-hour=1000",
        "game.limits.api-writes-per-minute=10000",
        "game.limits.api-per-minute=10000",
})
class ProgressFlowTest {
    @Autowired UserRepository users;
    @Autowired RoomRepository rooms;
    @Autowired AchievementRepository achievements;
    @Autowired SeasonRepository seasonRepo;
    @Autowired ProgressService progress;
    @Autowired SeasonService seasons;
    @Autowired MatchResultService results;

    private User newUser() {
        User u = new User("t" + UUID.randomUUID().toString().substring(0, 8), "x");
        return users.save(u);
    }

    private static int questReward(long userId, Quests.Kind... done) {
        int sum = 0;
        for (Quests.Def d : Quests.forDay(userId, ProgressService.today())) {
            for (Quests.Kind k : done) {
                if (d.kind() == k && d.target() == 1) {
                    sum += d.reward();
                }
            }
        }
        return sum;
    }

    @Test
    void doorAndRankedWinPayOnceAndSeasonCloses() {
        User a = newUser();
        User b = newUser();

        progress.onDoorSolved(a.getId(), "HARD");
        User a1 = users.findById(a.getId()).orElseThrow();
        assertEquals(1, a1.getDoorsSolved());
        assertEquals(1, a1.getHardDoorsSolved());
        assertTrue(achievements.existsByUserIdAndCode(a.getId(), Achievements.FIRST_DOOR));
        assertTrue(achievements.existsByUserIdAndCode(a.getId(), Achievements.HARD_DOOR));
        assertEquals(1000 + 50 + 150, a1.getPixels()); // no daily quest is done by a single door

        String code = "T" + UUID.randomUUID().toString().substring(0, 5).toUpperCase();
        Room room = new Room(code, RoomStatus.PLAYING);
        room.setRanked(true);
        room.setStartedAt(Instant.now().minusSeconds(120));
        room.getPlayers().add(new Player(a.getId(), a.getUsername(), 1500));
        room.getPlayers().add(new Player(b.getId(), b.getUsername(), 1500));
        rooms.save(room);

        results.finalizeMatch(code, a.getId(), "FINISH", List.of(), true);
        results.finalizeMatch(code, a.getId(), "FINISH", List.of(), true); // second call changes nothing

        User a2 = users.findById(a.getId()).orElseThrow();
        assertEquals(1, a2.getWins());
        assertEquals(1, a2.getSeasonMatches());
        assertEquals(1, a2.getWinStreak());
        assertTrue(achievements.existsByUserIdAndCode(a.getId(), Achievements.FIRST_WIN));
        int expected = 1200 + 150 /* ranked win */ + 100 /* FIRST_WIN */
                + questReward(a.getId(), Quests.Kind.WIN, Quests.Kind.RANKED);
        assertEquals(expected, a2.getPixels());
        assertEquals(3, progress.questsToday(a.getId()).size());

        User b2 = users.findById(b.getId()).orElseThrow();
        assertEquals(0, b2.getWinStreak());
        assertEquals(1000 + 25 + questReward(b.getId(), Quests.Kind.RANKED), b2.getPixels());

        // --- season end: make a an eligible leader, then pretend the month is over
        seasons.current();
        User lead = users.findById(a.getId()).orElseThrow();
        lead.setRating(1700);
        lead.setSeasonMatches(3);
        users.save(lead);
        Instant past = Instant.now().minus(40, ChronoUnit.DAYS);
        Season ending = seasonRepo.save(new Season(past, Instant.now().minusSeconds(5)));
        int before = users.findById(a.getId()).orElseThrow().getPixels();
        int bRating = users.findById(b.getId()).orElseThrow().getRating();

        seasons.rollover();

        Season closed = seasonRepo.findById(ending.getId()).orElseThrow();
        assertNotNull(closed.getClosedAt());
        List<SeasonResult> top = seasons.resultsOf(ending.getId());
        assertEquals(a.getId(), top.get(0).getUserId());
        assertEquals(1, top.get(0).getPlace());
        assertTrue(top.stream().noneMatch(r -> r.getUserId().equals(b.getId())), "too few matches for the top");
        User a3 = users.findById(a.getId()).orElseThrow();
        assertEquals(1600, a3.getRating());
        assertEquals(0, a3.getSeasonMatches());
        assertEquals(before + 1000, a3.getPixels());
        assertEquals(1500 + (bRating - 1500) / 2, users.findById(b.getId()).orElseThrow().getRating());
        Season next = seasons.current();
        assertTrue(next.getId() > ending.getId() && next.getEndsAt().isAfter(Instant.now()));

        seasons.rollover(); // nothing more to close
        assertEquals(1600, users.findById(a.getId()).orElseThrow().getRating());
    }
}
