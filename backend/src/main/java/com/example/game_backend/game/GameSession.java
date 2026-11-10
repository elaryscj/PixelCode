package com.example.game_backend.game;

import java.util.List;
import java.util.Map;

/** In-memory state of one running match. Access must be synchronized on the session. */
public class GameSession {
    public static final int DOORS = 4;

    public final String code;
    public final long startedAt;
    public final List<Snap> challenges;
    public final Slot[] slots;
    public boolean over;
    public long overAt;
    public Map<String, Object> result;

    public GameSession(String code, long startedAt, List<Snap> challenges, Slot[] slots) {
        this.code = code;
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
