package com.example.game_backend.progress;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * Daily quests. Every UTC day a player gets three, each from a different group, picked from their id and the
 * date (the same three however often the page is opened). Texts are in the frontend (quest_<code>).
 */
public final class Quests {
    private Quests() {
    }

    public enum Kind { PLAY, WIN, DOORS, TOUGH_DOORS, RANKED }

    public record Def(String code, Kind kind, int target, int reward) {
    }

    /** one inner list per group: a day never has two quests of the same kind */
    static final List<List<Def>> GROUPS = List.of(
            List.of(new Def("PLAY_2", Kind.PLAY, 2, 60), new Def("PLAY_3", Kind.PLAY, 3, 90)),
            List.of(new Def("WIN_1", Kind.WIN, 1, 80), new Def("WIN_2", Kind.WIN, 2, 150)),
            List.of(new Def("DOORS_4", Kind.DOORS, 4, 60), new Def("DOORS_8", Kind.DOORS, 8, 120)),
            List.of(new Def("TOUGH_2", Kind.TOUGH_DOORS, 2, 100)),
            List.of(new Def("RANKED_1", Kind.RANKED, 1, 70)));

    public static final int PER_DAY = 3;

    public static List<Def> forDay(long userId, LocalDate day) {
        Random random = new Random(userId * 1_000_003L + day.toEpochDay());
        List<List<Def>> groups = new ArrayList<>(GROUPS);
        Collections.shuffle(groups, random);
        List<Def> picked = new ArrayList<>();
        for (List<Def> group : groups.subList(0, PER_DAY)) {
            picked.add(group.get(random.nextInt(group.size())));
        }
        return picked;
    }

    public static Def get(String code) {
        for (List<Def> group : GROUPS) {
            for (Def d : group) {
                if (d.code().equals(code)) {
                    return d;
                }
            }
        }
        throw new IllegalArgumentException("Unknown quest " + code);
    }
}
