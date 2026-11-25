package com.example.game_backend.controller;

import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.AccountRules;
import com.example.game_backend.security.AdminAccess;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    private static final int MAX_AVATAR_CHARS = 400_000;

    private final UserRepository users;
    private final TokenService tokens;
    private final AdminAccess admins;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    private final com.example.game_backend.progress.ProgressService progress;
    private final com.example.game_backend.social.FriendService friends;
    private final com.example.game_backend.social.BlockService blocks;
    private final com.example.game_backend.tournament.TournamentService tournament;
    private final com.example.game_backend.repository.DoorResultRepository doorResults;
    private final com.example.game_backend.service.AuthService authService;
    private final com.example.game_backend.security.RateLimiter limiter;

    public ProfileController(UserRepository users, TokenService tokens, AdminAccess admins,
                             com.example.game_backend.service.AuthService auth,
                             com.example.game_backend.security.RateLimiter limiter,
                             com.example.game_backend.progress.ProgressService progress,
                             com.example.game_backend.social.FriendService friends,
                             com.example.game_backend.social.BlockService blocks,
                             com.example.game_backend.tournament.TournamentService tournament,
                             com.example.game_backend.repository.DoorResultRepository doorResults) {
        this.authService = auth;
        this.limiter = limiter;
        this.blocks = blocks;
        this.tournament = tournament;
        this.doorResults = doorResults;
        this.users = users;
        this.tokens = tokens;
        this.admins = admins;
        this.progress = progress;
        this.friends = friends;
    }

    private User me(long id, String auth) {
        long uid = tokens.requireUserId(auth);
        if (uid != id) {
            throw new ApiException(403, "This is not your profile");
        }
        return users.findById(uid).orElseThrow(() -> new ApiException(401, "Please log in again"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable long id,
                                                   @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(view(me(id, auth)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        User u = me(id, auth);
        String name = str(body.get("playerName"));
        if (name != null && !name.trim().equals(u.getUsername())) {
            try {
                name = AccountRules.username(name);
            } catch (ApiException e) {
                throw new ApiException(400, e.getMessage()).with("field", "playerName");
            }
            if (!name.equalsIgnoreCase(u.getUsername())) {
                if (users.existsByUsernameIgnoreCase(name) || admins.isReservedName(name)) {
                    throw new ApiException(409, "Nickname is already taken").with("field", "playerName");
                }
            }
            u.setUsername(name);
        }
        String email = str(body.get("email"));
        boolean emailChanged = false;
        if (email != null && !email.isBlank()) {
            email = AccountRules.email(email);
            if (!email.equalsIgnoreCase(u.getEmail())) {
                final String wanted = email;
                boolean taken = users.findAllByEmailIgnoreCase(wanted).stream().anyMatch(o -> !o.getId().equals(u.getId()));
                if (taken) {
                    throw new ApiException(409, "This e-mail is already used by another account").with("field", "email");
                }
            }
            emailChanged = !email.equalsIgnoreCase(u.getEmail());
            u.setEmail(email);
            if (emailChanged) u.setEmailVerified(false); // a new address has to be confirmed again
        } else if (body.containsKey("email")) {
            u.setEmail(null);
            u.setEmailVerified(false);
        }
        users.save(u);
        if (emailChanged) authService.resendConfirmation(u); // the link goes to the new address
        return ResponseEntity.ok(view(u));
    }

    @PutMapping("/{id}/avatar")
    public ResponseEntity<Map<String, Object>> avatar(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        User u = me(id, auth);
        String data = str(body.get("avatar"));
        if (data == null || !data.matches("(?s)^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$")
                || data.length() > MAX_AVATAR_CHARS) {
            throw new ApiException(400, "Avatar must be a small image");
        }
        u.setAvatarUrl(data);
        users.save(u);
        return ResponseEntity.ok(view(u));
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<Map<String, Object>> password(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                        @RequestHeader(value = "Authorization", required = false) String auth) {
        User u = me(id, auth);
        String current = str(body.get("currentPassword"));
        String next = str(body.get("newPassword"));
        String confirm = str(body.get("confirmNewPassword"));
        if (current == null || !encoder.matches(current, u.getPassword())) {
            throw new ApiException(400, "Current password is incorrect").with("field", "currentPassword");
        }
        AccountRules.password(next, "newPassword");
        if (!next.equals(confirm)) {
            throw new ApiException(400, "New passwords do not match").with("field", "confirmNewPassword");
        }
        u.setPassword(encoder.encode(next));
        u.setTokenVersion(u.getTokenVersion() + 1); // every other session is signed out
        users.save(u);
        tokens.invalidate(u.getId());
        // ...but this one continues with a fresh token
        return ResponseEntity.ok(Map.of("message", "Password updated successfully!",
                "token", tokens.issue(u.getId(), u.getTokenVersion())));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        User u = me(id, auth);
        if (!"DELETE".equals(str(body.get("confirmation"))) || !Boolean.TRUE.equals(body.get("acknowledged"))) {
            throw new ApiException(400, "Type DELETE and confirm to remove the account");
        }
        progress.deleteFor(u.getId());
        friends.deleteFor(u.getId());
        blocks.deleteFor(u.getId());
        tournament.deleteFor(u.getId());
        doorResults.deleteAllFor(u.getId()); // their code is shown in "best solutions": it goes with the account
        users.delete(u);
        tokens.invalidate(u.getId());
        return ResponseEntity.ok(Map.of("message", "Account deleted"));
    }

    /** The link from the confirmation e-mail (no login needed). */
    @GetMapping("/email/verify")
    public ResponseEntity<Map<String, Object>> verify(@RequestParam(value = "token", required = false) String token) {
        authService.confirmEmail(token);
        return ResponseEntity.ok(Map.of("message", "E-mail confirmed"));
    }

    /** "Send the link again" from the profile and the reminder banner. */
    @PostMapping("/{id}/email/resend")
    public ResponseEntity<Map<String, Object>> resend(@PathVariable long id,
                                                      @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User u = me(id, authHeader);
        limiter.hit("verify-mail:" + u.getId(), 3, 3600); // no flooding of one inbox
        boolean sent = authService.resendConfirmation(u);
        return ResponseEntity.ok(Map.of("sent", sent));
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Map<String, Object> view(User u) {
        int r = u.getRating();
        String rank = r < 1200 ? "BYTE ROOKIE" : r < 1500 ? "CODE RUNNER" : r < 1800 ? "PIXEL HACKER"
                : r < 2100 ? "ARENA VETERAN" : "GRANDMASTER";
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("playerName", u.getUsername());
        m.put("email", u.getEmail());
        m.put("emailVerified", u.getEmail() != null && u.isEmailVerified());
        m.put("pendingEmail", null);
        m.put("mmr", r);
        m.put("rankTitle", rank);
        m.put("avatarUrl", u.getAvatarUrl());
        return m;
    }
}
