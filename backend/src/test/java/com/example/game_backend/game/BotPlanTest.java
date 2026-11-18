package com.example.game_backend.game;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BotPlanTest {
    private static final long DOOR_MS = 240_000;
    private static final long START = 1_763_000_000_000L;

    private static BotPlan plan(int mapId, int rating, List<String> levels, long seed) {
        GameSession.Slot slot = new GameSession.Slot(-1, "PIXEL_BOT", rating, 0);
        BotPlan plan = new BotPlan(slot, mapId, levels, rating, START, DOOR_MS, new Random(seed));
        plan.planAll(() -> 0); // a clock that never runs late: plan synchronously
        return plan;
    }

    @Test
    void botReallyStandsAtEveryDoorAndAtTheExitOnEveryMap() {
        for (int map = 0; map < GameSession.MAP_COUNT; map++) {
            MapGeometry.Arena arena = MapGeometry.of(map);
            BotPlan p = plan(map, 1500, List.of("EASY", "EASY", "MEDIUM", "HARD"), map);
            for (int k = 1; k <= GameSession.DOORS; k++) {
                double[] at = p.positionAt(p.arriveAt[k]);
                assertTrue(MapGeometry.nearDoor(arena, k, at[0], at[1]), "map " + map + " door " + k);
                assertTrue(p.solvedAt[k] > p.arriveAt[k], "solves after arriving");
                assertTrue(p.solvedAt[k] - p.arriveAt[k] <= DOOR_MS, "never slower than the door timer");
                if (k > 1) {
                    assertTrue(p.leaveAt[k] > p.solvedAt[k - 1], "doors in order");
                }
            }
            double[] end = p.positionAt(p.arriveAt[5] + 1);
            assertTrue(MapGeometry.atExit(arena, end[0], end[1]), "map " + map + " exit");
        }
    }

    @Test
    void newcomersFaceASlowerBotThanStrongPlayers() {
        List<String> levels = List.of("EASY", "EASY", "EASY", "MEDIUM");
        long slow = plan(0, 1400, levels, 7).arriveAt[5] - START;
        long fast = plan(0, 1900, levels, 7).arriveAt[5] - START;
        assertTrue(slow > fast * 2, "1400 MMR: " + slow + " ms, 1900 MMR: " + fast + " ms");
        // a 1500-MMR newcomer: several minutes for the whole map, so a first win is realistic
        long newcomer = plan(0, 1500, levels, 3).arriveAt[5] - START;
        assertTrue(newcomer > 3 * 60_000 && newcomer < 8 * 60_000, "newcomer race lasts " + newcomer / 1000 + " s");
    }

    @Test
    void doorsGetHarderWithRating() {
        assertEquals(List.of("EASY", "EASY", "EASY", "MEDIUM"), GameService.doorDifficulties(1500));
        assertEquals(List.of("EASY", "EASY", "MEDIUM", "MEDIUM"), GameService.doorDifficulties(1600));
        assertEquals(List.of("EASY", "MEDIUM", "MEDIUM", "HARD"), GameService.doorDifficulties(1700));
        assertEquals(List.of("MEDIUM", "MEDIUM", "HARD", "HARD"), GameService.doorDifficulties(1850));
    }

    @Test
    void botRewardsStayFarBelowRankedOnes() {
        assertEquals(40, MatchResultService.botReward("WIN"));
        assertEquals(10, MatchResultService.botReward("LOSS"));
        assertEquals(0, MatchResultService.botReward("VOID"));
    }
}
