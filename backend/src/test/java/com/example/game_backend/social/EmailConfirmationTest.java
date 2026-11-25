package com.example.game_backend.social;

import com.example.game_backend.controller.ProfileController;
import com.example.game_backend.dto.AuthRequest;
import com.example.game_backend.dto.AuthResponse;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import com.example.game_backend.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Real PostgreSQL ("pixelcode_test"): a new account confirms its e-mail with the signed link. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/pixelcode_test",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.limits.register-per-hour=1000",
        "game.limits.api-writes-per-minute=10000",
        "game.limits.api-per-minute=10000",
})
class EmailConfirmationTest {
    @Autowired AuthService auth;
    @Autowired ProfileController profile;
    @Autowired UserRepository users;
    @Autowired TokenService tokens;

    private AuthResponse register() {
        String id = UUID.randomUUID().toString().substring(0, 8);
        AuthRequest req = new AuthRequest();
        req.setUsername("m" + id);
        req.setPassword("secret123");
        req.setEmail("m" + id + "@example.com");
        return auth.register(req);
    }

    @Test
    void newAccountConfirmsWithTheLink() {
        AuthResponse r = register();
        assertFalse(r.emailVerified(), "a new account starts unconfirmed");
        User u = users.findById(r.id()).orElseThrow();

        assertEquals(400, assertThrows(ApiException.class, () -> auth.confirmEmail("garbage")).getStatus());
        assertEquals(400, assertThrows(ApiException.class, () -> auth.confirmEmail(null)).getStatus());
        // a link for another address (or a forged one) is refused
        String wrong = tokens.issueEmailVerify(u.getId(), "someone@else.com");
        assertEquals(400, assertThrows(ApiException.class, () -> auth.confirmEmail(wrong)).getStatus());

        auth.confirmEmail(tokens.issueEmailVerify(u.getId(), u.getEmail().toUpperCase()));
        assertTrue(users.findById(u.getId()).orElseThrow().isEmailVerified());
        assertTrue(auth.me(u.getId()).emailVerified());
        // nothing left to send
        assertFalse(auth.resendConfirmation(users.findById(u.getId()).orElseThrow()));
    }

    @Test
    void changingTheEmailNeedsANewConfirmation() {
        AuthResponse r = register();
        User u = users.findById(r.id()).orElseThrow();
        String oldLink = tokens.issueEmailVerify(u.getId(), u.getEmail());
        auth.confirmEmail(oldLink);

        String bearer = "Bearer " + r.token();
        String fresh = "n" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        Map<String, Object> view = profile.update(u.getId(), Map.of("email", fresh), bearer).getBody();
        assertEquals(false, view.get("emailVerified"));
        // the link sent to the old address no longer confirms the new one
        assertEquals(400, assertThrows(ApiException.class, () -> auth.confirmEmail(oldLink)).getStatus());
        assertEquals(true, profile.resend(u.getId(), bearer).getBody().get("sent"));

        auth.confirmEmail(tokens.issueEmailVerify(u.getId(), fresh));
        assertEquals(true, profile.get(u.getId(), bearer).getBody().get("emailVerified"));
    }
}
