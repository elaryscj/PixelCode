package com.example.game_backend.game;

import java.util.LinkedHashMap;
import java.util.Map;

/** Server-side price list: the client never decides what a skin costs. */
public final class SkinCatalog {
    public static final Map<String, Integer> PRICES = new LinkedHashMap<>();

    static {
        PRICES.put("neon_ronin", 1200);
        PRICES.put("crimson_cipher", 1500);
        PRICES.put("byte_knight", 900);
        PRICES.put("pumpkin_phantom", 0); // Halloween skin, free for now
    }

    private SkinCatalog() {
    }

    public static boolean exists(String id) {
        return PRICES.containsKey(id);
    }
}
