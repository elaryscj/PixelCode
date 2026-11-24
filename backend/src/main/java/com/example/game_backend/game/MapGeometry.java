package com.example.game_backend.game;

/**
 * Door and exit positions of every arena map, so the server can check where a player is when they open
 * a door or claim the finish. Units are % of one arena panel (the player's own, never mirrored);
 * `y` is the floor the object stands on.
 *
 * MUST mirror MAPS in frontend/app/game/maps.ts (same order). MapGeometryTest fails when they drift apart.
 */
public final class MapGeometry {
    public static final double CHAR_W = 6;
    public static final double DOOR_W = 6.5;

    public record Arena(double startX, double startY, double[][] doors, double[] exit) {
        public double exitX() { return exit[0]; }
        public double exitY() { return exit[1]; }
        public double exitW() { return exit[2]; }
        public double exitH() { return exit[3]; }
    }

    public static final Arena[] MAPS = {
            // 0 MIRROR CIRCUIT
            new Arena(4.0, 3.0,
                    new double[][]{{62.0, 3.0}, {30.0, 27.0}, {66.0, 51.0}, {50.0, 75.0}},
                    new double[]{4.0, 75.0, 20.0, 12.0}),
            // 1 PISTON WORKS
            new Arena(4.0, 3.0,
                    new double[][]{{20.0, 3.0}, {44.0, 27.0}, {30.0, 51.0}, {40.0, 75.0}},
                    new double[]{4.0, 75.0, 22.0, 12.0}),
            // 2 ACID GARDENS
            new Arena(4.0, 3.0,
                    new double[][]{{80.0, 3.0}, {40.0, 27.0}, {34.0, 51.0}, {70.0, 75.0}},
                    new double[]{16.0, 75.0, 20.0, 12.0}),
            // 3 FROST LINE
            new Arena(4.0, 3.0,
                    new double[][]{{60.0, 3.0}, {24.0, 27.0}, {64.0, 51.0}, {36.0, 75.0}},
                    new double[]{4.0, 75.0, 22.0, 12.0}),
            // 4 CLOCKWORK SPIRE
            new Arena(4.0, 3.0,
                    new double[][]{{20.0, 3.0}, {50.0, 27.0}, {22.0, 51.0}, {66.0, 75.0}},
                    new double[]{18.0, 75.0, 20.0, 12.0}),
            // 5 DATA STREAM
            new Arena(4.0, 3.0,
                    new double[][]{{12.0, 3.0}, {54.0, 27.0}, {26.0, 51.0}, {34.0, 75.0}},
                    new double[]{4.0, 75.0, 22.0, 12.0}),
    };

    private MapGeometry() {
    }

    public static Arena of(int mapId) {
        return MAPS[Math.floorMod(mapId, MAPS.length)];
    }

    /** Standing at the door (the client shows the E prompt within 10 units; a little slack for lag). */
    public static boolean nearDoor(Arena a, int cp, double x, double y) {
        double[] d = a.doors()[cp - 1];
        double dx = Math.abs(x + CHAR_W / 2 - (d[0] + DOOR_W / 2));
        return dx <= 13 && y >= d[1] - 2 && y <= d[1] + 8;
    }

    public static boolean atExit(Arena a, double x, double y) {
        return x + CHAR_W >= a.exitX() - 3 && x <= a.exitX() + a.exitW() + 3
                && y >= a.exitY() - 2 && y <= a.exitY() + a.exitH() + 2;
    }
}
