package com.example.game_backend.game;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.LongSupplier;

/**
 * PIXEL_BOT's race: how long it "solves" each door (rolled when the match starts) and the way it runs from
 * door to door, found by actually playing the level (BotPathfinder over BotPhysics, the server copy of the
 * players' physics). So the bot jumps from platform to platform, rides lifts and avoids hazards instead of
 * gliding through the floors. The server replays this timeline (GameService.botTick) and sends the same
 * MOVE / DOOR_UNLOCKED / finish events a human would.
 *
 * <p>Routes are planned in the background ({@link #planInBackground}); until a stretch is planned the bot
 * stands where it is. Pace: a door takes longer the harder it is (EASY / MEDIUM / HARD) and the lower the
 * human's MMR, with +-25 % randomness, so a newcomer usually has the time to beat it.
 */
final class BotPlan {
    private static final Logger log = LoggerFactory.getLogger(BotPlan.class);
    static final long START_DELAY_MS = 2500;
    private static final long PAUSE_MS = 400;
    private static final double FRAME_MS = 1000.0 / 60;
    private static final long NOT_YET = Long.MAX_VALUE;

    /** One planner thread for all matches, at low priority: a bot's route never slows the real players down. */
    private static final ExecutorService PLANNER = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "bot-planner");
        t.setDaemon(true);
        t.setPriority(Thread.MIN_PRIORITY);
        return t;
    });

    final GameSession.Slot slot;
    private final BotPhysics phys;
    private final long[] solveMs = new long[GameSession.DOORS + 1];
    private final long doorMs;
    private final long startAt;

    /** index 1..4 = run to door k, 5 = run to the exit; NOT_YET until planned */
    final long[] leaveAt = new long[6];
    final long[] arriveAt = new long[6];
    final long[] solvedAt = new long[5];
    private final BotPathfinder.Route[] routes = new BotPathfinder.Route[6];
    private volatile boolean cancelled;

    BotPlan(GameSession.Slot slot, int mapId, List<String> doorDifficulties, int humanRating,
            long start, long doorMs, Random rnd) {
        this.slot = slot;
        this.phys = BotPhysics.forMap(mapId);
        this.doorMs = doorMs;
        this.startAt = start;
        double pace = paceFor(humanRating);
        for (int k = 1; k <= GameSession.DOORS; k++) {
            String level = k - 1 < doorDifficulties.size() ? doorDifficulties.get(k - 1) : "EASY";
            solveMs[k] = Math.round(baseSolveMs(level) * pace * (0.75 + rnd.nextDouble() * 0.5));
        }
        java.util.Arrays.fill(leaveAt, NOT_YET);
        java.util.Arrays.fill(arriveAt, NOT_YET);
        java.util.Arrays.fill(solvedAt, NOT_YET);
    }

    static void planInBackground(BotPlan plan) {
        PLANNER.submit(() -> {
            try {
                plan.planAll(System::currentTimeMillis);
            } catch (RuntimeException e) {
                log.error("Planning PIXEL_BOT's route failed", e);
            }
        });
    }

    void cancel() {
        cancelled = true;
    }

    /** Plans every stretch in order. Each starts when the previous door is solved (or later, if planning lagged). */
    void planAll(LongSupplier clock) {
        BotPhysics.State at = phys.start();
        long leave = startAt;
        for (int k = 1; k <= 5 && !cancelled; k++) {
            int goal = k <= GameSession.DOORS ? k : 0;
            BotPathfinder.Route route = null;
            for (int attempt = 0; attempt < 3; attempt++) {
                long began = clock.getAsLong();
                route = BotPathfinder.find(phys, at, goal, leave / 1000.0);
                long now = clock.getAsLong();
                if (now <= leave) {
                    break;
                }
                // planning took longer than the time left before this stretch: start a bit later, with
                // the moving platforms where they will really be then
                leave = now + Math.max(500, (now - began) * 2);
            }
            if (route == null) {
                log.warn("PIXEL_BOT found no route to {} on map {}", goal == 0 ? "the exit" : "door " + goal,
                        phys.map().name());
                route = straightRoute(at, goal);
            }
            long arrive = leave + Math.round((route.frames() - 1) * FRAME_MS);
            synchronized (this) {
                routes[k] = route;
                leaveAt[k] = leave;
                arriveAt[k] = arrive;
                if (k <= GameSession.DOORS) {
                    // a door opens by itself after doorMs anyway; the bot never waits longer than that
                    solvedAt[k] = arrive + Math.min(solveMs[k], doorMs - 2000);
                }
            }
            at = route.end();
            if (k <= GameSession.DOORS) {
                leave = solvedAt[k] + PAUSE_MS;
            }
        }
    }

    /** Where the bot is at time t: on its route, or standing where the last planned stretch ended. */
    synchronized double[] positionAt(long t) {
        BotPhysics.State start = null;
        double[] last = null;
        for (int k = 1; k <= 5; k++) {
            BotPathfinder.Route r = routes[k];
            if (r == null) {
                break;
            }
            if (t < leaveAt[k]) {
                return new double[]{r.xs()[0], r.ys()[0]};
            }
            if (t < arriveAt[k]) {
                double f = (t - leaveAt[k]) / FRAME_MS;
                int i = (int) Math.floor(f);
                double frac = f - i;
                int j = Math.min(i + 1, r.frames() - 1);
                i = Math.min(i, r.frames() - 1);
                return new double[]{r.xs()[i] + (r.xs()[j] - r.xs()[i]) * frac, r.ys()[i] + (r.ys()[j] - r.ys()[i]) * frac};
            }
            last = new double[]{r.end().x, r.end().y};
        }
        if (last != null) {
            return last;
        }
        start = phys.start();
        return new double[]{start.x, start.y};
    }

    /** Last resort if the search ever fails: walk there in a straight line (the old behaviour), logged above. */
    private BotPathfinder.Route straightRoute(BotPhysics.State from, int goal) {
        ArenaLayout.Map m = phys.map();
        double tx;
        double ty;
        if (goal == 0) {
            tx = m.exit().x() + m.exit().w() / 2 - BotPhysics.CHAR_W / 2;
            ty = m.exit().y();
        } else {
            ArenaLayout.Door d = m.doors().get(goal - 1);
            tx = d.x() + BotPhysics.DOOR_W / 2 - BotPhysics.CHAR_W / 2;
            ty = d.y();
        }
        int frames = 60 + (int) Math.round((Math.abs(tx - from.x) + Math.abs(ty - from.y)) / 14 * 60);
        double[] xs = new double[frames + 1];
        double[] ys = new double[frames + 1];
        for (int i = 0; i <= frames; i++) {
            double p = (double) i / frames;
            xs[i] = from.x + (tx - from.x) * p;
            ys[i] = from.y + (ty - from.y) * p;
        }
        BotPhysics.State end = from.copy();
        end.x = tx;
        end.y = ty;
        end.vx = 0;
        end.vy = 0;
        end.grounded = true;
        end.surface = -1;
        end.riding = -1;
        return new BotPathfinder.Route(xs, ys, end, new int[frames]);
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
}
