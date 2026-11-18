package com.example.game_backend.game;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Finds how PIXEL_BOT gets from where it stands to the next door (or the exit) by actually playing the level:
 * a breadth-first search over key presses held for {@link #HOLD} frames, run through {@link BotPhysics} at the
 * real world time, so the route uses the real platforms, waits for lifts and blinking blocks and never
 * touches a hazard.
 *
 * <p>To keep the search small the way up is split floor by floor (first "stand on the next floor", then the
 * one after, then "stand at the door"); each piece is the fastest at this step size.
 */
final class BotPathfinder {
    /** frames each choice of keys is held (0.1 s) */
    static final int HOLD = 6;
    private static final double FRAME = 1.0 / 60;
    private static final int MAX_STEPS = 600; // 60 s per piece
    private static final int MAX_NODES = 300_000;

    // idle, right, left, jump, right + jump, left + jump
    private static final boolean[][] ACTIONS = {
            {false, false, false}, {false, true, false}, {true, false, false},
            {false, false, true}, {false, true, true}, {true, false, true},
    };

    /** A route: the bot's position every frame from the start time, where it ends up, and the keys held each
     *  frame (bit 1 left, 2 right, 4 jump). */
    record Route(double[] xs, double[] ys, BotPhysics.State end, int[] keys) {
        int frames() {
            return xs.length;
        }
    }

    private interface Goal {
        boolean reached(BotPhysics.State s, BotPhysics.Step r);
    }

    private static final class Node {
        final BotPhysics.State s;
        final Node parent;
        final int action;

        Node(BotPhysics.State s, Node parent, int action) {
            this.s = s;
            this.parent = parent;
            this.action = action;
        }
    }

    private BotPathfinder() {
    }

    /**
     * Route from `from` (world time `t0`, seconds) to door `goalDoor` (1..4; the doors before it are open)
     * or, with goalDoor = 0, to the exit. Null when no route was found within the limits.
     */
    static Route find(BotPhysics phys, BotPhysics.State from, int goalDoor, double t0) {
        ArenaLayout.Map map = phys.map();
        int unlocked = goalDoor == 0 ? GameSession.DOORS : goalDoor - 1;
        double targetY = goalDoor == 0 ? map.exit().y() : map.doors().get(goalDoor - 1).y();
        Goal atGoal = (s, r) -> s.grounded && Math.abs(s.vx) < 0.03
                && (goalDoor == 0 ? r.atExit() : r.nearDoor() == goalDoor);

        List<Route> pieces = new ArrayList<>();
        BotPhysics.State s = from;
        double t = t0;
        for (double floor : map.floors()) {
            if (floor <= s.y + 0.01 || floor >= targetY - 0.01) {
                continue;
            }
            Goal onFloor = (st, r) -> st.grounded && Math.abs(st.y - floor) < 0.01 && phys.onSteadyGround(st);
            Route piece = search(phys, s, onFloor, unlocked, t);
            if (piece == null) {
                pieces.clear(); // the floor-by-floor split did not work out: search the whole way at once
                s = from;
                t = t0;
                break;
            }
            pieces.add(piece);
            s = piece.end();
            t += (piece.frames() - 1) * FRAME;
        }
        Route last = search(phys, s, atGoal, unlocked, t);
        if (last == null) {
            return null;
        }
        pieces.add(last);
        return join(pieces);
    }

    private static Route join(List<Route> pieces) {
        int n = 1;
        for (Route r : pieces) {
            n += r.frames() - 1;
        }
        double[] xs = new double[n];
        double[] ys = new double[n];
        int i = 0;
        for (int k = 0; k < pieces.size(); k++) {
            Route r = pieces.get(k);
            int from = k == 0 ? 0 : 1; // each piece starts where the previous one ended
            for (int j = from; j < r.frames(); j++) {
                xs[i] = r.xs()[j];
                ys[i] = r.ys()[j];
                i++;
            }
        }
        int[] keys = new int[n - 1];
        int at = 0;
        for (Route r : pieces) {
            System.arraycopy(r.keys(), 0, keys, at, r.keys().length);
            at += r.keys().length;
        }
        return new Route(xs, ys, pieces.get(pieces.size() - 1).end(), keys);
    }

    private static Route search(BotPhysics phys, BotPhysics.State from, Goal goal, int unlocked, double t0) {
        List<Node> layer = new ArrayList<>();
        layer.add(new Node(from.copy(), null, -1));
        Set<Long> seen = new HashSet<>();
        int nodes = 0;
        for (int step = 0; step < MAX_STEPS && !layer.isEmpty(); step++) {
            double tStep = t0 + step * HOLD * FRAME;
            List<Node> next = new ArrayList<>();
            for (Node n : layer) {
                boolean canJump = n.s.grounded || n.s.coyote > 0;
                for (int a = 0; a < ACTIONS.length; a++) {
                    if (a >= 3 && !canJump) {
                        continue; // a jump in the air is the same as no jump
                    }
                    BotPhysics.State s = n.s.copy();
                    BotPhysics.Step r = null;
                    boolean dead = false;
                    for (int f = 0; f < HOLD; f++) {
                        double t = tStep + (f + 1) * FRAME;
                        // a jump is a single press, on the first frame
                        r = phys.step(s, ACTIONS[a][0], ACTIONS[a][1], ACTIONS[a][2] && f == 0, unlocked, t, t - FRAME);
                        if (r.hitHazard()) {
                            dead = true;
                            break;
                        }
                    }
                    if (dead) {
                        continue;
                    }
                    Node child = new Node(s, n, a);
                    if (goal.reached(s, r)) {
                        return trace(phys, from, child, unlocked, t0);
                    }
                    // The same spot later can be a different situation: a lift arrived, a saw moved on. Standing
                    // still is told apart per step (so the bot can wait), states near moving parts per 0.3 s (coarser);
                    // everything else counts once, which keeps the search small.
                    long key = s.grounded && Math.abs(s.vx) < 0.05 ? key(s, 2L * (step + 1), 2)
                            : phys.nearMovingParts(s) ? key(s, 2L * (step / 3 + 1) + 1, 1) : key(s, 0, 2);
                    if (seen.add(key)) {
                        next.add(child);
                        if (++nodes > MAX_NODES) {
                            return null;
                        }
                    }
                }
            }
            layer = next;
        }
        return null;
    }

    /** `res` 2 = half-unit positions and fine speeds, 1 = whole units and coarse speeds. */
    private static long key(BotPhysics.State s, long bucket, int res) {
        long x = Math.round(s.x * res);
        long y = Math.round(s.y * res);
        long vx = Math.round(s.vx * 10 * res) + 64;
        long vy = Math.round(s.vy * 5 * res) + 64;
        long g = s.grounded ? 1 : 0;
        return (((((bucket * 512 + x) * 256 + y) * 128 + vx) * 128 + vy) * 2) + g;
    }

    /** Replays the chosen key presses frame by frame to record every position. */
    private static Route trace(BotPhysics phys, BotPhysics.State from, Node goal, int unlocked, double t0) {
        List<Integer> actions = new ArrayList<>();
        for (Node n = goal; n.parent != null; n = n.parent) {
            actions.add(n.action);
        }
        java.util.Collections.reverse(actions);
        BotPhysics.State s = from.copy();
        double[] xs = new double[actions.size() * HOLD + 1];
        double[] ys = new double[xs.length];
        xs[0] = s.x;
        ys[0] = s.y;
        int[] keys = new int[xs.length - 1];
        int i = 1;
        for (int step = 0; step < actions.size(); step++) {
            boolean[] k = ACTIONS[actions.get(step)];
            for (int f = 0; f < HOLD; f++) {
                keys[i - 1] = (k[0] ? 1 : 0) | (k[1] ? 2 : 0) | (k[2] && f == 0 ? 4 : 0);
                double t = t0 + (step * HOLD + f + 1) * FRAME;
                phys.step(s, k[0], k[1], k[2] && f == 0, unlocked, t, t - FRAME);
                xs[i] = s.x;
                ys[i] = s.y;
                i++;
            }
        }
        return new Route(xs, ys, s, keys);
    }
}
