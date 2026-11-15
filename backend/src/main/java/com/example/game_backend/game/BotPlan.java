package com.example.game_backend.game;

import java.util.List;
import java.util.Random;

/**
 * PIXEL_BOT's whole race, decided when the match starts: when it reaches each door, how long it "solves" it and
 * when it reaches the exit. The server replays this timeline (GameService.botTick), so the bot sends the same
 * MOVE / DOOR_UNLOCKED / finish events a human would.
 *
 * <p>Pace: a door takes longer the harder it is (EASY / MEDIUM / HARD) and the lower the human's MMR, with
 * +-25 % randomness, so a newcomer usually has the time to beat it while strong players get a real race.
 */
final class BotPlan {
    static final long START_DELAY_MS = 2500;
    private static final double WALK_SPEED = 14; // map % per second, well below a human's top speed
    private static final long WALK_BASE_MS = 1500;
    private static final long PAUSE_MS = 400;

    final GameSession.Slot slot;
    /** 0 = start, 1..4 = in front of door 1..4, 5 = exit */
    final double[][] points = new double[6][];
    final long[] leaveAt = new long[6];
    final long[] arriveAt = new long[6];
    final long[] solvedAt = new long[5];

    BotPlan(GameSession.Slot slot, MapGeometry.Arena arena, List<String> doorDifficulties, int humanRating,
            long start, long doorMs, Random rnd) {
        this.slot = slot;
        points[0] = new double[]{arena.startX(), arena.startY()};
        for (int k = 1; k <= GameSession.DOORS; k++) {
            double[] d = arena.doors()[k - 1];
            points[k] = new double[]{d[0] + MapGeometry.DOOR_W / 2 - MapGeometry.CHAR_W / 2, d[1]};
        }
        points[5] = new double[]{arena.exitX() + arena.exitW() / 2 - MapGeometry.CHAR_W / 2, arena.exitY()};

        double pace = paceFor(humanRating);
        long t = start;
        for (int k = 1; k <= 5; k++) {
            leaveAt[k] = t;
            arriveAt[k] = t + walkMs(points[k - 1], points[k]);
            if (k <= GameSession.DOORS) {
                String level = k - 1 < doorDifficulties.size() ? doorDifficulties.get(k - 1) : "EASY";
                long solve = Math.round(baseSolveMs(level) * pace * (0.75 + rnd.nextDouble() * 0.5));
                // a door opens by itself after doorMs anyway; the bot never waits longer than that
                solvedAt[k] = arriveAt[k] + Math.min(solve, doorMs - 2000);
                t = solvedAt[k] + PAUSE_MS;
            }
        }
    }

    /** Slower against newcomers, faster against strong players. */
    static double paceFor(int rating) {
        if (rating < 1450) {
            return 2.0;
        }
        if (rating < 1550) {
            return 1.6;
        }
        if (rating < 1650) {
            return 1.2;
        }
        if (rating < 1800) {
            return 1.0;
        }
        return 0.8;
    }

    static long baseSolveMs(String level) {
        switch (level) {
            case "HARD": return 90_000;
            case "MEDIUM": return 60_000;
            default: return 35_000;
        }
    }

    private static long walkMs(double[] a, double[] b) {
        double dist = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
        return WALK_BASE_MS + Math.round(dist / WALK_SPEED * 1000);
    }

    /** Where the bot is at time t: walking along the floor, then jumping up to the next door's level. */
    double[] positionAt(long t) {
        for (int k = 1; k <= 5; k++) {
            if (t < leaveAt[k]) {
                return points[k - 1];
            }
            if (t < arriveAt[k]) {
                double p = (double) (t - leaveAt[k]) / (arriveAt[k] - leaveAt[k]);
                double[] a = points[k - 1];
                double[] b = points[k];
                if (p < 0.7) {
                    return new double[]{a[0] + (b[0] - a[0]) * (p / 0.7), a[1]};
                }
                double q = (p - 0.7) / 0.3;
                double eased = q * q * (3 - 2 * q);
                return new double[]{b[0], a[1] + (b[1] - a[1]) * eased};
            }
        }
        return points[5];
    }
}
