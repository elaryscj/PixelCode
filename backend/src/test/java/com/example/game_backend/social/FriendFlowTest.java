package com.example.game_backend.social;

import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.progress.ProgressService;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import com.example.game_backend.service.RoomService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Real PostgreSQL ("pixelcode_test"): friend requests, status, duel invitations and the daily login streak. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/pixelcode_test",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.limits.register-per-hour=1000",
        "game.limits.api-writes-per-minute=10000",
        "game.limits.api-per-minute=10000",
})
class FriendFlowTest {
    @Autowired FriendService friends;
    @Autowired UserRepository users;
    @Autowired TokenService tokens;
    @Autowired RoomService rooms;
    @Autowired ProgressService progress;

    private User newUser() {
        return users.save(new User("f" + UUID.randomUUID().toString().substring(0, 8), "x"));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> part(Map<String, Object> list, String key) {
        return (List<Map<String, Object>>) list.get(key);
    }

    @Test
    void requestAcceptChallengeAndInvite() {
        User a = newUser();
        User b = newUser();
        assertThrows(ApiException.class, () -> friends.request(a.getId(), a.getUsername()));
        assertThrows(ApiException.class, () -> friends.request(a.getId(), "nobody_" + UUID.randomUUID()));

        assertEquals(false, friends.request(a.getId(), b.getUsername()).get("accepted"));
        assertThrows(ApiException.class, () -> friends.request(a.getId(), b.getUsername())); // already sent
        assertEquals(1, friends.pendingFor(b.getId()));
        assertEquals(1, part(friends.list(b.getId()), "incoming").size());
        assertEquals(1, part(friends.list(a.getId()), "outgoing").size());

        // b asking back is a yes
        assertEquals(true, friends.request(b.getId(), a.getUsername()).get("accepted"));
        assertEquals(0, friends.pendingFor(b.getId()));
        Map<String, Object> friendOfA = part(friends.list(a.getId()), "friends").get(0);
        assertEquals(b.getId(), friendOfA.get("userId"));
        assertEquals("OFFLINE", friendOfA.get("status"));

        // offline friends cannot be challenged; once b uses the game they are online
        assertThrows(ApiException.class, () -> friends.challenge(a.getId(), b.getId()));
        tokens.verify(tokens.issue(b.getId(), 0));
        assertEquals("ONLINE", part(friends.list(a.getId()), "friends").get(0).get("status"));

        String code = String.valueOf(friends.challenge(a.getId(), b.getId()).get("code"));
        List<Map<String, Object>> inv = friends.invitesFor(b.getId());
        assertEquals(1, inv.size());
        assertEquals(code, inv.get(0).get("code"));
        assertEquals(a.getUsername(), inv.get(0).get("fromName"));
        // a second challenge reuses the same waiting room and does not duplicate the invitation
        assertEquals(code, String.valueOf(friends.challenge(a.getId(), b.getId()).get("code")));
        assertEquals(1, friends.invitesFor(b.getId()).size());

        // b joins: the room is no longer waiting, the invitation disappears
        rooms.joinRoom(code, b.getId());
        assertTrue(friends.invitesFor(b.getId()).isEmpty());
        assertEquals("IN_MATCH", part(friends.list(a.getId()), "friends").get(0).get("status"));

        long requestId = ((Number) friendOfA.get("requestId")).longValue();
        friends.remove(a.getId(), requestId);
        assertTrue(part(friends.list(b.getId()), "friends").isEmpty());
    }

    @Test
    void dailyLoginStreak() {
        User u = newUser();
        Map<String, Object> first = progress.dailyLogin(u.getId());
        assertEquals(true, first.get("claimed"));
        assertEquals(1, first.get("streak"));
        assertEquals(20, first.get("reward"));
        assertEquals(1020, users.findById(u.getId()).orElseThrow().getPixels());
        assertEquals(false, progress.dailyLogin(u.getId()).get("claimed")); // same day: nothing more

        // came back the next day after six days in a row: day 7 pays 100
        User s = users.findById(u.getId()).orElseThrow();
        s.setLoginStreak(6);
        s.setLastLoginDay(ProgressService.today().minusDays(1));
        users.save(s);
        Map<String, Object> seventh = progress.dailyLogin(u.getId());
        assertEquals(7, seventh.get("streak"));
        assertEquals(100, seventh.get("reward"));

        // a missed day starts again at 1
        s = users.findById(u.getId()).orElseThrow();
        s.setLastLoginDay(ProgressService.today().minusDays(3));
        users.save(s);
        Map<String, Object> restart = progress.dailyLogin(u.getId());
        assertEquals(1, restart.get("streak"));
        assertEquals(20, restart.get("reward"));
    }
}
