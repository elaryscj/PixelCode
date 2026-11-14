package com.example.game_backend.game;

import java.util.List;
import java.util.Map;

/** In-memory state of one running match. Access must be synchronized on the session. */
public class GameSession {
    public static final int DOORS = 4;
    /** Number of arena maps; must match MAPS in frontend/app/game/maps.ts (see MapGeometry). */
    public static final int MAP_COUNT = 6;
    /** Grid used to remember where a player has been (for respawn teleports): 5x5-unit cells. */
    static final int CELL = 5;
    static final int CELLS = 100 / CELL + 1;

    public final String code;
    public final int mapId;
    /** ranked queue match: rating, PIXELS and absence bans apply. Private rooms are just for fun. */
    public final boolean ranked;
    public final long startedAt;
    public final List<Snap> challenges;
    public final Slot[] slots;
    public boolean over;
    public long overAt;
    public Map<String, Object> result;

    public GameSession(String code, int mapId, boolean ranked, long startedAt, List<Snap> challenges, Slot[] slots) {
        this.code = code;
        this.mapId = mapId;
        this.ranked = ranked;
        this.startedAt = startedAt;
        this.challenges = challenges;
        this.slots = slots;
    }

    public static class Snap {
        public final long id;
        public final String title, description, inputDescription, outputDescription, functionName, starterCode, examples, testsJson;

        public Snap(long id, String title, String description, String inputDescription, String outputDescription,
                    String functionName, String starterCode, String examples, String testsJson) {
            this.id = id;
            this.title = title;
            this.description = description;
            this.inputDescription = inputDescription;
            this.outputDescription = outputDescription;
            this.functionName = functionName;
            this.starterCode = starterCode;
            this.examples = examples;
            this.testsJson = testsJson;
        }
    }

    public static class Slot {
        public final long userId;
        public final String nickname;
        public final int rating;
        public String skin = "neon_ronin";
        public final boolean[] unlocked = new boolean[DOORS + 1];
        public final long[] doorStartedAt = new long[DOORS + 1];
        public final long[] lastSubmitAt = new long[DOORS + 1];
        public long lastSeen;
        public double x;
        public double y;
        /** when the last position was accepted (0 = none yet) */
        public long posAt;
        /** anti-cheat movement budget (units), refilled at the fastest legal speed; see GameService.reportPosition */
        public long lastReportAt;
        public double budgetX;
        public double budgetUp;
        public double budgetDown;
        public int rejectedMoves;
        /** cells this player has stood in: respawning may jump back to any of them */
        public final boolean[][] visited = new boolean[CELLS][CELLS];

        void markVisited(double px, double py) {
            visited[cell(px)][cell(py)] = true;
        }

        /** Marks every cell on the straight path of an accepted move, so any spot passed can be a respawn target. */
        void markPath(double fromX, double fromY, double toX, double toY) {
            double len = Math.hypot(toX - fromX, toY - fromY);
            int steps = Math.max(1, (int) Math.ceil(len / (CELL / 2.0)));
            for (int i = 0; i <= steps; i++) {
                double t = (double) i / steps;
                markVisited(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t);
            }
        }

        /** Exactly a cell already passed through (no neighbours: they would let a cheater creep forward). */
        boolean visited(double px, double py) {
            return visited[cell(px)][cell(py)];
        }

        private static int cell(double v) {
            return Math.max(0, Math.min(CELLS - 1, (int) (v / CELL)));
        }

        public Slot(long userId, String nickname, int rating, long now) {
            this.userId = userId;
            this.nickname = nickname;
            this.rating = rating;
            this.lastSeen = now;
        }

        public int unlockedCount() {
            int n = 0;
            for (int i = 1; i <= DOORS; i++) {
                if (unlocked[i]) {
                    n++;
                }
            }
            return n;
        }
    }

    public Slot slot(long userId) {
        for (Slot s : slots) {
            if (s.userId == userId) {
                return s;
            }
        }
        return null;
    }

    public Slot other(long userId) {
        for (Slot s : slots) {
            if (s.userId != userId) {
                return s;
            }
        }
        return null;
    }
}
