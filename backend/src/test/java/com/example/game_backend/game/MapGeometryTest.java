package com.example.game_backend.game;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The server's copy of door / exit positions (MapGeometry) must match the maps the players actually see
 * (frontend/app/game/maps.ts). Run from the repo: ./mvnw test -Dtest=MapGeometryTest
 */
class MapGeometryTest {
    private static final Path MAPS_TS = Path.of("..", "frontend", "app", "game", "maps.ts");
    private static final Pattern NUM = Pattern.compile("-?\\d+(?:\\.\\d+)?|GROUND_Y");
    private static final Pattern DOOR = Pattern.compile("\\{\\s*num:\\s*\\d+,\\s*x:\\s*([\\d.]+),\\s*y:\\s*([\\w.]+)");
    private static final Pattern EXIT = Pattern.compile("exit:\\s*\\{\\s*x:\\s*([\\d.]+),\\s*y:\\s*([\\w.]+),\\s*w:\\s*([\\d.]+),\\s*h:\\s*([\\d.]+)");
    private static final Pattern START = Pattern.compile("start:\\s*\\{\\s*x:\\s*([\\d.]+),\\s*y:\\s*([\\w.]+)");

    private static double num(String s) {
        return s.equals("GROUND_Y") ? 3.0 : Double.parseDouble(s);
    }

    @Test
    void serverGeometryMatchesFrontendMaps() throws Exception {
        Assumptions.assumeTrue(Files.exists(MAPS_TS), "frontend sources not present (e.g. backend-only Docker build)");
        String src = Files.readString(MAPS_TS);
        // order of the MAPS array
        Matcher list = Pattern.compile("export const MAPS: MapDef\\[] = \\[([^\\]]+)]").matcher(src);
        assertTrue(list.find(), "MAPS array not found");
        String[] names = list.group(1).split(",");
        assertEquals(MapGeometry.MAPS.length, names.length, "number of maps (also update GameSession.MAP_COUNT)");
        assertEquals(GameSession.MAP_COUNT, names.length, "GameSession.MAP_COUNT");

        for (int i = 0; i < names.length; i++) {
            String name = names[i].trim();
            int at = src.indexOf("const " + name + ": MapDef = {");
            assertTrue(at >= 0, "map " + name + " not found");
            int end = src.indexOf("\n};", at);
            String block = src.substring(at, end);
            MapGeometry.Arena arena = MapGeometry.MAPS[i];

            Matcher st = START.matcher(block);
            assertTrue(st.find(), name + ": start");
            assertEquals(num(st.group(1)), arena.startX(), name + " start x");
            assertEquals(num(st.group(2)), arena.startY(), name + " start y");

            List<double[]> doors = new ArrayList<>();
            Matcher d = DOOR.matcher(block);
            while (d.find()) {
                doors.add(new double[]{num(d.group(1)), num(d.group(2))});
            }
            assertEquals(arena.doors().length, doors.size(), name + ": door count");
            for (int k = 0; k < doors.size(); k++) {
                assertArrayEquals(doors.get(k), arena.doors()[k], 1e-9, name + ": door " + (k + 1));
            }

            Matcher e = EXIT.matcher(block);
            assertTrue(e.find(), name + ": exit");
            assertArrayEquals(new double[]{num(e.group(1)), num(e.group(2)), num(e.group(3)), num(e.group(4))},
                    arena.exit(), 1e-9, name + ": exit");
        }
    }
}
