package com.example.game_backend.game;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BotPathfinderTest {
    /** The bot can play every map from the start through all four doors to the exit, at any moment. */
    @Test
    void botFindsARealRouteThroughEveryMap() {
        for (double t0 : new double[]{1_763_000_000.0, 1_763_000_001.7, 1_763_000_013.3}) {
            for (int map = 0; map < ArenaLayout.MAPS.size(); map++) {
                BotPhysics phys = BotPhysics.forMap(map);
                BotPhysics.State s = phys.start();
                double t = t0;
                long started = System.nanoTime();
                for (int goal : new int[]{1, 2, 3, 4, 0}) {
                    BotPathfinder.Route r = BotPathfinder.find(phys, s, goal, t);
                    assertNotNull(r, "map " + map + " goal " + goal + " t0 " + t0);
                    s = r.end();
                    t += (r.frames() - 1) / 60.0 + 30; // pretend it solved the door for 30 s
                }
                long ms = (System.nanoTime() - started) / 1_000_000;
                System.out.println("map " + map + " planned in " + ms + " ms");
                assertTrue(ms < 5000, "planning too slow: " + ms + " ms");
            }
        }
    }
}
