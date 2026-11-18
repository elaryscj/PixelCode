package com.example.game_backend.game;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;

/**
 * Full arena maps (platforms, hazards, doors, exit) as the players see them, read from
 * resources/game/maps.json. That file is generated from frontend/app/game/maps.ts by
 * `npm run export-maps`; MapGeometryTest fails when it is stale. Used by PIXEL_BOT's physics (BotPhysics).
 */
public final class ArenaLayout {
    public record Motion(String axis, double range, double period, Double phase) {
        double offset(double t) {
            double ph = phase == null ? 0 : phase;
            return range * (1 - Math.cos(2 * Math.PI * (t / period + ph))) / 2;
        }
    }

    public record Platform(double x, double y, double w, String kind, Motion move, Double push, Double power,
                           Double period, Double phase) {
        String kindOr() { return kind == null ? "solid" : kind; }

        double xAt(double t) { return x + (move != null && "x".equals(move.axis()) ? move.offset(t) : 0); }

        double yAt(double t) { return y + (move != null && "y".equals(move.axis()) ? move.offset(t) : 0); }

        boolean blinkSolid(double t) {
            double p = period == null ? 3 : period;
            double f = (t / p + (phase == null ? 0 : phase)) % 1;
            if (f < 0) {
                f += 1;
            }
            return f < 0.5;
        }
    }

    public record Hazard(double x, double y, double w, Double h, String kind, Motion move) {
        double height() {
            if (h != null) {
                return h;
            }
            String k = kind == null ? "spikes" : kind;
            switch (k) {
                case "acid": return 3;
                case "saw":
                case "icicle": return 6;
                default: return 4;
            }
        }

        double xAt(double t) { return x + (move != null && "x".equals(move.axis()) ? move.offset(t) : 0); }

        double yAt(double t) { return y + (move != null && "y".equals(move.axis()) ? move.offset(t) : 0); }
    }

    public record Door(int num, double x, double y, String exit) {
    }

    public record Point(double x, double y) {
    }

    public record Exit(double x, double y, double w, double h) {
    }

    public record Map(int id, String name, List<Double> floors, Point start, List<Platform> platforms,
                      List<Hazard> hazards, List<Door> doors, Exit exit) {
    }

    public static final List<Map> MAPS = load();

    private ArenaLayout() {
    }

    public static Map of(int mapId) {
        return MAPS.get(Math.floorMod(mapId, MAPS.size()));
    }

    private static List<Map> load() {
        JsonMapper json = JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();
        try (InputStream in = ArenaLayout.class.getResourceAsStream("/game/maps.json")) {
            if (in == null) {
                throw new IllegalStateException("resources/game/maps.json is missing (run npm run export-maps)");
            }
            return json.readValue(in, new TypeReference<List<Map>>() { });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
