package com.example.game_backend.progress;

import com.example.game_backend.entity.User;

import java.util.List;
import java.util.function.ToIntFunction;

/**
 * The achievement list. Each one is earned once and pays its PIXELS at that moment. Names and descriptions
 * live in the frontend translations (ach_<code>_name / ach_<code>_desc).
 */
public final class Achievements {
    private Achievements() {
    }

    /**
     * @param counter how far the player is (null = no progress bar, just earned or not)
     */
    public record Def(String code, int reward, int target, ToIntFunction<User> counter) {
    }

    public static final String FIRST_DOOR = "FIRST_DOOR";
    public static final String DOORS_25 = "DOORS_25";
    public static final String DOORS_100 = "DOORS_100";
    public static final String HARD_DOOR = "HARD_DOOR";
    public static final String FIRST_WIN = "FIRST_WIN";
    public static final String WINS_10 = "WINS_10";
    public static final String WINS_50 = "WINS_50";
    public static final String STREAK_3 = "STREAK_3";
    public static final String RATING_1700 = "RATING_1700";
    public static final String BOT_SLAYER = "BOT_SLAYER";
    public static final String FRIENDLY = "FRIENDLY";
    public static final String COLLECTOR = "COLLECTOR";

    public static final List<Def> ALL = List.of(
            new Def(FIRST_DOOR, 50, 1, User::getDoorsSolved),
            new Def(DOORS_25, 150, 25, User::getDoorsSolved),
            new Def(DOORS_100, 400, 100, User::getDoorsSolved),
            new Def(HARD_DOOR, 150, 1, User::getHardDoorsSolved),
            new Def(FIRST_WIN, 100, 1, User::getWins),
            new Def(WINS_10, 250, 10, User::getWins),
            new Def(WINS_50, 600, 50, User::getWins),
            new Def(STREAK_3, 200, 3, User::getWinStreak),
            new Def(RATING_1700, 300, 1700, User::getRating),
            new Def(BOT_SLAYER, 50, 1, null),
            new Def(FRIENDLY, 50, 1, null),
            new Def(COLLECTOR, 50, 1, null));

    public static Def get(String code) {
        for (Def d : ALL) {
            if (d.code().equals(code)) {
                return d;
            }
        }
        throw new IllegalArgumentException("Unknown achievement " + code);
    }
}
