package com.example.game_backend.controller;

import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.UserRepository;
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
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9_]{3,16}$");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int MAX_AVATAR_CHARS = 400_000;

    private final UserRepository users;
    private final TokenService tokens;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    public ProfileController(UserRepository users, TokenService tokens) {
        this.users = users;
        this.tokens = tokens;
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
        if (name != null) {
            name = name.trim();
            if (!USERNAME.matcher(name).matches()) {
                throw new ApiException(400, "Nickname must be 3-16 characters: letters, digits or underscore")
                        .with("field", "playerName");
            }
            if (!name.equalsIgnoreCase(u.getUsername()) && users.existsByUsernameIgnoreCase(name)) {
                throw new ApiException(409, "Nickname is already taken").with("field", "playerName");
            }
            u.setUsername(name);
        }
        String email = str(body.get("email"));
        if (email != null && !email.isBlank()) {
            email = email.trim();
            if (!EMAIL.matcher(email).matches() || email.length() > 120) {
                throw new ApiException(400, "Enter a valid e-mail address").with("field", "email");
            }
            u.setEmail(email);
        } else if (body.containsKey("email")) {
            u.setEmail(null);
        }
        users.save(u);
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
        if (next == null || next.length() < 8 || next.length() > 72) {
            throw new ApiException(400, "New password must be 8-72 characters").with("field", "newPassword");
        }
        if (!next.equals(confirm)) {
            throw new ApiException(400, "New passwords do not match").with("field", "confirmNewPassword");
        }
        u.setPassword(encoder.encode(next));
        users.save(u);
        return ResponseEntity.ok(Map.of("message", "Password updated successfully!"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        User u = me(id, auth);
        if (!"DELETE".equals(str(body.get("confirmation"))) || !Boolean.TRUE.equals(body.get("acknowledged"))) {
            throw new ApiException(400, "Type DELETE and confirm to remove the account");
        }
        users.delete(u);
        return ResponseEntity.ok(Map.of("message", "Account deleted"));
    }

    @GetMapping("/email/verify")
    public ResponseEntity<Map<String, Object>> verify() {
        return ResponseEntity.ok(Map.of("message", "E-mail is already confirmed"));
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
        m.put("emailVerified", u.getEmail() != null);
        m.put("pendingEmail", null);
        m.put("mmr", r);
        m.put("rankTitle", rank);
        m.put("avatarUrl", u.getAvatarUrl());
        return m;
    }
}
