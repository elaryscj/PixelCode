package com.example.game_backend.social;

import com.example.game_backend.controller.PlayerController;
import com.example.game_backend.controller.ReplayController;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.ReplayStore;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Real PostgreSQL ("pixelcode_test"): only the two players may watch a replay; only friends see a profile. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/pixelcode_test",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.limits.register-per-hour=1000",
        "game.limits.api-writes-per-minute=10000",
        "game.limits.api-per-minute=10000",
})
class ReplayAndProfileAccessTest {
    @Autowired ReplayStore replays;
    @Autowired ReplayController replayController;
    @Autowired PlayerController players;
    @Autowired FriendService friends;
    @Autowired UserRepository users;
    @Autowired TokenService tokens;

    private User newUser() {
        return users.save(new User("r" + UUID.randomUUID().toString().substring(0, 8), "x"));
    }

    private String auth(User u) {
        return "Bearer " + tokens.issue(u.getId(), u.getTokenVersion());
    }

    @Test
    void replayIsForItsPlayersAndProfileForFriends() {
        User a = newUser();
        User b = newUser();
        User stranger = newUser();
        String code = "R" + UUID.randomUUID().toString().substring(0, 5).toUpperCase();
        replays.save(code, Map.of(
                "players", List.of(Map.of("userId", a.getId()), Map.of("userId", b.getId())),
                "doors", List.of(Map.of("cp", 1, "title", "GATE // PARITY LOCK",
                        "description", "Write a method `solve(n)` that returns true if the integer is even, otherwise false."))));

        assertEquals(2, ((List<?>) replayController.get(code, auth(b)).getBody().get("players")).size());
        assertEquals(403, assertThrows(ApiException.class, () -> replayController.get(code, auth(stranger))).getStatus());
        assertEquals(404, assertThrows(ApiException.class, () -> replayController.get("NOPE00", auth(a))).getStatus());

        // profiles: yourself always, others only once you are friends
        assertEquals(a.getUsername(), players.profile(a.getId(), auth(a)).getBody().get("username"));
        assertEquals(403, assertThrows(ApiException.class, () -> players.profile(b.getId(), auth(a))).getStatus());
        friends.request(a.getId(), b.getUsername());
        assertEquals(403, assertThrows(ApiException.class, () -> players.profile(b.getId(), auth(a))).getStatus(),
                "a request is not a friendship yet");
        friends.request(b.getId(), a.getUsername());
        Map<String, Object> p = players.profile(b.getId(), auth(a)).getBody();
        assertEquals(b.getUsername(), p.get("username"));
        assertEquals(12, ((List<?>) p.get("achievements")).size());
    }
}
