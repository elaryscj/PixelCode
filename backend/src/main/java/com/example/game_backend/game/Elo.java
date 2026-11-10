package com.example.game_backend.game;

public final class Elo {
    public static final int K = 32;

    private Elo() {
    }

    public static double expected(int own, int other) {
        return 1.0 / (1.0 + Math.pow(10.0, (other - own) / 400.0));
    }

    /** score: 1 win, 0.5 draw, 0 loss. */
    public static int delta(int own, int other, double score) {
        return (int) Math.round(K * (score - expected(own, other)));
    }
}
