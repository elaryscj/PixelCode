package com.example.game_backend;

import com.example.game_backend.entity.User;
import com.example.game_backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real HTTP + real PostgreSQL (a separate local database "pixelcode_test", never the game data):
 * simultaneous purchases must not spend the same pixels twice.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/pixelcode_test",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.limits.register-per-hour=1000",
        "game.limits.api-writes-per-minute=10000",
        "game.limits.api-per-minute=10000",
})
class StoreConcurrencyTest {
    @LocalServerPort
    int port;

    @Autowired
    UserRepository users;

    private final HttpClient http = HttpClient.newHttpClient();

    private HttpResponse<String> call(String method, String path, String token, String body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + path))
                .header("Content-Type", "application/json")
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        if (token != null) {
            b.header("Authorization", "Bearer " + token);
        }
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private String register() throws Exception {
        String name = "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        HttpResponse<String> r = call("POST", "/auth/register", null,
                "{\"username\":\"" + name + "\",\"email\":\"" + name + "@test.local\",\"password\":\"Test12345!\"}");
        assertEquals(200, r.statusCode(), r.body());
        Matcher m = Pattern.compile("\"token\":\"([^\"]+)\"").matcher(r.body());
        assertTrue(m.find());
        return m.group(1);
    }

    @Test
    void storeOpensAndParallelPurchasesNeverOverspend() throws Exception {
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(16);
        try {
            for (int round = 0; round < 5; round++) {
                String token = register();
                // the store view must work (it is a plain read, outside any transaction)
                HttpResponse<String> view = call("GET", "/store", token, null);
                assertEquals(200, view.statusCode(), view.body());
                Matcher idm = Pattern.compile("\"id\":(\\d+)").matcher(call("GET", "/auth/me", token, null).body());
                assertTrue(idm.find());
                long id = Long.parseLong(idm.group(1));

                User u = users.findById(id).orElseThrow();
                u.setPixels(1500); // enough for crimson_cipher (1500) OR byte_knight (900), never both
                users.save(u);

                // all requests leave at the same instant
                java.util.concurrent.CountDownLatch go = new java.util.concurrent.CountDownLatch(1);
                List<java.util.concurrent.Future<HttpResponse<String>>> calls = new ArrayList<>();
                for (int i = 0; i < 16; i++) {
                    String skin = i % 2 == 0 ? "crimson_cipher" : "byte_knight";
                    calls.add(pool.submit(() -> {
                        go.await();
                        return call("POST", "/store/buy/" + skin, token, null);
                    }));
                }
                go.countDown();
                long ok = 0;
                for (java.util.concurrent.Future<HttpResponse<String>> f : calls) {
                    if (f.get().statusCode() == 200) {
                        ok++;
                    }
                }

                User after = users.findById(id).orElseThrow();
                int spent = 1500 - after.getPixels();
                boolean crimson = after.getOwnedSkins().contains("crimson_cipher");
                boolean knight = after.getOwnedSkins().contains("byte_knight");
                assertTrue(after.getPixels() >= 0, "balance went negative");
                assertFalse(crimson && knight, "bought both skins with money for one");
                // the first skin also earns the COLLECTOR achievement, paid exactly once
                int collector = com.example.game_backend.progress.Achievements.get("COLLECTOR").reward();
                assertEquals((crimson ? 1500 : 0) + (knight ? 900 : 0) - collector, spent, "paid amount does not match owned skins");
                assertEquals(1, ok, "exactly one purchase can succeed, got " + ok);
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
