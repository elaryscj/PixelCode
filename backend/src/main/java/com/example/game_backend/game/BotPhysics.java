package com.example.game_backend.game;

import java.util.HashMap;
import java.util.List;

/**
 * A line-by-line Java port of the player physics in frontend/app/game/physics.ts (stepPlayer), so PIXEL_BOT
 * walks, jumps, rides lifts and avoids hazards exactly like a human client would. Units: % of an arena
 * panel per 60 FPS frame. `t` is world time in seconds (epoch ms / 1000): moving parts are a function of
 * it, the same clock the players' browsers use.
 *
 * <p>Keep in sync with physics.ts when the movement rules change.
 */
final class BotPhysics {
    static final double GRAVITY = 0.038;
    static final double MOVE_SPEED = 0.42;
    static final double JUMP_FORCE = 1.08;
    static final double FRICTION = 0.82;
    static final double ICE_FRICTION = 0.965;
    static final double ICE_MAX_SPEED = 0.7;
    static final double CHAR_W = 6;
    static final double CHAR_H = 11;
    static final double DOOR_W = 6.5;
    static final double BARRIER_H = 18;
    static final double GROUND_Y = 3;
    static final double PLATFORM_H = 2.6;
    /** drawn thickness under a fixed platform's top; the block is solid all the way down */
    static final double PLATFORM_DEPTH = 0.8;
    static final double CRUMBLE_AFTER = 0.55;
    static final double CRUMBLE_RESPAWN = 2.5;

    static final class State {
        double x, y, vx, vy;
        boolean grounded;
        double coyote;
        int riding = -1;
        int surface = -1;
        /** per platform: seconds stood on a crumbling one / world time until it is back */
        double[] crumbleStood;
        double[] crumbleBrokenUntil;

        State(int platforms) {
            crumbleStood = new double[platforms];
            crumbleBrokenUntil = new double[platforms];
        }

        State copy() {
            State s = new State(0);
            s.x = x;
            s.y = y;
            s.vx = vx;
            s.vy = vy;
            s.grounded = grounded;
            s.coyote = coyote;
            s.riding = riding;
            s.surface = surface;
            // maps without crumbling blocks share the empty arrays: the planner copies states a lot
            s.crumbleStood = crumbleStood.length == 0 ? crumbleStood : crumbleStood.clone();
            s.crumbleBrokenUntil = crumbleBrokenUntil.length == 0 ? crumbleBrokenUntil : crumbleBrokenUntil.clone();
            return s;
        }
    }

    /** Result of one frame. */
    record Step(boolean hitHazard, int nearDoor, boolean atExit) {
    }

    private final ArenaLayout.Map map;
    private final double[] hazardFloor;
    /** boxes (x1, y1, x2, y2) swept by moving platforms and hazards and covered by blinking blocks */
    private final List<double[]> movingBoxes = new java.util.ArrayList<>();

    BotPhysics(ArenaLayout.Map map) {
        this.map = map;
        this.hazardFloor = new double[map.hazards().size()];
        for (int i = 0; i < hazardFloor.length; i++) {
            hazardFloor[i] = computeHazardFloor(map.hazards().get(i));
        }
        for (ArenaLayout.Platform p : map.platforms()) {
            if (p.move() != null || p.kindOr().equals("blink")) {
                movingBoxes.add(sweep(p.x(), p.y(), p.w(), 0, p.move()));
            }
        }
        for (ArenaLayout.Hazard h : map.hazards()) {
            if (h.move() != null) {
                movingBoxes.add(sweep(h.x(), h.y(), h.w(), h.height(), h.move()));
            }
        }
    }

    private static double[] sweep(double x, double y, double w, double h, ArenaLayout.Motion m) {
        double rx = m != null && "x".equals(m.axis()) ? m.range() : 0;
        double ry = m != null && "y".equals(m.axis()) ? m.range() : 0;
        return new double[]{x, y, x + w + rx, y + h + ry};
    }

    /** Standing on a plain, steady platform (not a lift, belt, bounce pad, blinking or crumbling block). */
    boolean onSteadyGround(State s) {
        if (s.surface < 0) {
            return false;
        }
        ArenaLayout.Platform p = map.platforms().get(s.surface);
        String k = p.kindOr();
        return p.move() == null && (k.equals("solid") || k.equals("ice"));
    }

    /** Close enough to a moving / blinking part that timing matters (a jump's reach around it). */
    boolean nearMovingParts(State s) {
        for (double[] b : movingBoxes) {
            if (s.x + CHAR_W > b[0] - 14 && s.x < b[2] + 14 && s.y > b[1] - 18 && s.y < b[3] + 16) {
                return true;
            }
        }
        return false;
    }

    ArenaLayout.Map map() {
        return map;
    }

    State start() {
        boolean crumbles = map.platforms().stream().anyMatch(p -> p.kindOr().equals("crumble"));
        State s = new State(crumbles ? map.platforms().size() : 0);
        s.x = map.start().x();
        s.y = map.start().y();
        s.grounded = true;
        return s;
    }

    private boolean platformSolid(ArenaLayout.Platform p, int i, double t, State s) {
        String k = p.kindOr();
        if (k.equals("blink")) {
            return p.blinkSolid(t);
        }
        if (k.equals("crumble")) {
            return s.crumbleBrokenUntil[i] <= t;
        }
        return true;
    }

    /** One frame (dt = 1) of stepPlayer. `unlocked` = number of doors open (doors open in order). */
    Step step(State p, boolean left, boolean right, boolean jump, int unlocked, double t, double tPrev) {
        final double dt = 1;
        List<ArenaLayout.Platform> plats = map.platforms();

        // 1. carried by the platform we stood on, pushed by belts
        if (p.riding >= 0 && p.grounded) {
            ArenaLayout.Platform rp = plats.get(p.riding);
            if (rp.move() != null) {
                p.x += rp.xAt(t) - rp.xAt(tPrev);
                p.y += rp.yAt(t) - rp.yAt(tPrev);
            }
            if (rp.kindOr().equals("conveyor")) {
                p.x += (rp.push() == null ? 0 : rp.push()) * dt;
            }
        }

        // 2. input
        ArenaLayout.Platform surface = p.surface >= 0 ? plats.get(p.surface) : null;
        boolean onIce = p.grounded && surface != null && surface.kindOr().equals("ice");
        double accel = MOVE_SPEED * 0.25 * (onIce ? 0.45 : 1);
        if (left) {
            p.vx -= accel * dt;
        }
        if (right) {
            p.vx += accel * dt;
        }
        if (jump && (p.grounded || p.coyote > 0)) {
            p.vy = JUMP_FORCE;
            p.grounded = false;
            p.coyote = 0;
        }
        p.vx *= Math.pow(onIce ? ICE_FRICTION : FRICTION, dt);
        if (onIce) {
            p.vx = Math.max(-ICE_MAX_SPEED, Math.min(ICE_MAX_SPEED, p.vx));
        }
        p.vy -= GRAVITY * dt;

        double prevX = p.x;
        double prevY = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 1) {
            p.x = 1;
            p.vx = 0;
        }
        if (p.x > 100 - CHAR_W - 1) {
            p.x = 100 - CHAR_W - 1;
            p.vx = 0;
        }

        // 3. locked doors are walls
        for (ArenaLayout.Door cp : map.doors()) {
            if (cp.num() <= unlocked) {
                continue;
            }
            double l = cp.x();
            double r = cp.x() + DOOR_W;
            boolean sameHeight = p.y < cp.y() + BARRIER_H && p.y >= cp.y() - 1;
            if (sameHeight && p.x + CHAR_W > l && p.x < r) {
                if (prevX + CHAR_W <= l + 0.01) {
                    p.x = l - CHAR_W;
                    p.vx = Math.min(p.vx, 0);
                } else if (prevX >= r - 0.01) {
                    p.x = r;
                    p.vx = Math.max(p.vx, 0);
                } else if ("left".equals(cp.exit())) {
                    p.x = r;
                } else {
                    p.x = l - CHAR_W;
                }
            }
        }

        // 4a. fixed blocks are solid: bump your head on the underside, stop at the sides.
        // The collision box is a little narrower than the sprite (like most platformers), so the
        // player slips through gaps about as wide as the character.
        for (ArenaLayout.Platform plat : plats) {
            if (!isSolidBlock(plat)) {
                continue;
            }
            double top = plat.y();
            double bot = blockBottom(plat);
            double l = plat.x();
            double r = plat.x() + plat.w();
            boolean overY = p.y < top - EPS && p.y + CHAR_H > bot + EPS;
            boolean prevOverY = prevY < top - EPS && prevY + CHAR_H > bot + EPS;
            boolean sideX = p.x + CHAR_W - SIDE_INSET > l && p.x + SIDE_INSET < r;
            boolean prevSideX = prevX + CHAR_W - SIDE_INSET > l + EPS && prevX + SIDE_INSET < r - EPS;
            if (overY && prevOverY && sideX && !prevSideX) {
                if (prevX + CHAR_W - SIDE_INSET <= l + EPS) {
                    p.x = l - CHAR_W + SIDE_INSET;
                    p.vx = Math.min(p.vx, 0);
                } else {
                    p.x = r - SIDE_INSET;
                    p.vx = Math.max(p.vx, 0);
                }
                continue;
            }
            boolean headX = p.x + CHAR_W - HEAD_INSET > l && p.x + HEAD_INSET < r;
            if (headX && p.vy > 0 && prevY + CHAR_H <= bot + 0.6 && p.y + CHAR_H > bot) {
                p.y = bot - CHAR_H;
                p.vy = 0;
            }
        }

        // 4b. landing on top of any platform (moving, blinking and crumbling ones stay one-way)
        p.grounded = false;
        p.riding = -1;
        int standing = -1;
        for (int i = 0; i < plats.size(); i++) {
            ArenaLayout.Platform plat = plats.get(i);
            if (!platformSolid(plat, i, t, p)) {
                continue;
            }
            double px = plat.xAt(t);
            double py = plat.yAt(t);
            double prevPy = plat.move() != null ? plat.yAt(tPrev) : py;
            double rise = Math.max(0, py - prevPy);
            boolean inside = p.x + CHAR_W > px + 0.5 && p.x < px + plat.w() - 0.5;
            if (inside && prevY >= prevPy - 0.6 - rise && p.y <= py && p.vy <= 0) {
                p.y = py;
                p.vy = 0;
                p.grounded = true;
                p.riding = i;
                standing = i;
                break;
            }
        }
        if (p.y < GROUND_Y) {
            p.y = GROUND_Y;
            p.vy = 0;
            p.grounded = true;
        }
        if (p.y > 92) {
            p.y = 92;
            p.vy = Math.min(p.vy, 0);
        }

        // 5. special surfaces
        if (standing >= 0 && plats.get(standing).kindOr().equals("bounce")) {
            Double pw = plats.get(standing).power();
            p.vy = pw == null ? 1.25 : pw;
            p.grounded = false;
            p.riding = -1;
            standing = -1;
        }
        if (standing >= 0 && plats.get(standing).kindOr().equals("crumble")) {
            p.crumbleStood[standing] += dt / 60;
            if (p.crumbleStood[standing] >= CRUMBLE_AFTER) {
                p.crumbleStood[standing] = 0;
                p.crumbleBrokenUntil[standing] = t + CRUMBLE_RESPAWN;
            }
        }
        for (int i = 0; i < p.crumbleStood.length; i++) {
            if (i != p.riding && p.crumbleStood[i] > 0) {
                p.crumbleStood[i] = Math.max(0, p.crumbleStood[i] - dt / 240);
            }
        }
        p.surface = standing;
        p.coyote = p.grounded ? 5 : Math.max(0, p.coyote - dt);

        // 6. hazards
        boolean hit = false;
        List<ArenaLayout.Hazard> hz = map.hazards();
        for (int i = 0; i < hz.size(); i++) {
            ArenaLayout.Hazard h = hz.get(i);
            double hx = h.xAt(t);
            double hy = h.yAt(t);
            double hh = h.height();
            boolean onItsFloor = p.y >= hazardFloor[i] - 1;
            if (onItsFloor && p.x + CHAR_W > hx + 1 && p.x < hx + h.w() - 1 && p.y < hy + hh - 1
                    && p.y + CHAR_H > hy + 0.5) {
                hit = true;
                break;
            }
        }

        // 7. door prompt
        int near = 0;
        for (ArenaLayout.Door cp : map.doors()) {
            if (cp.num() > unlocked) {
                double dx = Math.abs(p.x + CHAR_W / 2 - (cp.x() + DOOR_W / 2));
                if (dx < 10 && p.y >= cp.y() - 0.5 && p.y < cp.y() + 6) {
                    near = cp.num();
                    break;
                }
            }
        }
        ArenaLayout.Exit ex = map.exit();
        boolean atExit = unlocked >= GameSession.DOORS && p.x + CHAR_W >= ex.x() && p.x <= ex.x() + ex.w()
                && p.y >= ex.y() - 0.5 && p.y <= ex.y() + ex.h();
        return new Step(hit, near, atExit);
    }

    private static final double EPS = 0.01;
    /** how much narrower than the sprite the collision box is, at the head and at the sides */
    static final double HEAD_INSET = 1.6;
    static final double SIDE_INSET = 1.2;

    /** Fixed, always-there platforms are solid blocks; lifts, blinking and crumbling ones are one-way. */
    static boolean isSolidBlock(ArenaLayout.Platform p) {
        String k = p.kindOr();
        return p.move() == null && !k.equals("blink") && !k.equals("crumble");
    }

    /** Bottom of a solid block: ground blocks and low pillars (over acid) reach the floor. */
    static double blockBottom(ArenaLayout.Platform p) {
        if (p.y() <= GROUND_Y + 0.5 || (p.move() == null && p.y() <= 10.5)) {
            return 0;
        }
        return p.y() - PLATFORM_H - PLATFORM_DEPTH;
    }

    private double computeHazardFloor(ArenaLayout.Hazard h) {
        double reach = h.move() != null && "x".equals(h.move().axis()) ? h.move().range() : 0;
        double floor = GROUND_Y;
        for (ArenaLayout.Platform pl : map.platforms()) {
            if (pl.move() != null) {
                continue;
            }
            boolean overlaps = pl.x() < h.x() + h.w() + reach && pl.x() + pl.w() > h.x();
            if (overlaps && pl.y() <= h.y() + 0.01 && pl.y() > floor) {
                floor = pl.y();
            }
        }
        return floor;
    }

    /** Cached per map: physics objects are immutable apart from the State they step. */
    private static final java.util.Map<Integer, BotPhysics> CACHE = new HashMap<>();

    static synchronized BotPhysics forMap(int mapId) {
        return CACHE.computeIfAbsent(Math.floorMod(mapId, ArenaLayout.MAPS.size()),
                id -> new BotPhysics(ArenaLayout.of(id)));
    }
}
