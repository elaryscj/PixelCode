package com.example.game_backend.controller;

import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** Administrators look players up and change their PIXELS balance. */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {
    private final UserRepository users;
    private final TokenService tokens;

    public AdminUserController(UserRepository users, TokenService tokens) {
        this.users = users;
        this.tokens = tokens;
    }

    private void requireAdmin(String auth) {
        long id = tokens.requireUserId(auth);
        User u = users.findById(id).orElseThrow(() -> new ApiException(401, "Please log in again"));
        if (!tokens.isAdminUsername(u.getUsername())) {
            throw new ApiException(403, "Administrator access required");
        }
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> search(@RequestParam(defaultValue = "") String q,
                                                            @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        String needle = q.trim().toLowerCase();
        List<Map<String, Object>> out = new ArrayList<>();
        for (User u : users.findTop50ByOrderByRatingDescIdAsc()) {
            if (needle.isEmpty() || u.getUsername().toLowerCase().contains(needle)) out.add(view(u));
        }
        if (!needle.isEmpty()) {
            users.findByUsernameIgnoreCase(needle).ifPresent(u -> {
                if (out.stream().noneMatch(m -> m.get("id").equals(u.getId()))) out.add(0, view(u));
            });
        }
        return ResponseEntity.ok(out);
    }

    /** body: {"mode":"set"|"add", "amount": 500}  (add accepts negative numbers) */
    @PostMapping("/{id}/balance")
    public ResponseEntity<Map<String, Object>> balance(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                       @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        User u = users.findById(id).orElseThrow(() -> new ApiException(404, "Player not found"));
        long amount;
        try {
            amount = Long.parseLong(String.valueOf(body.get("amount")).trim());
        } catch (NumberFormatException e) {
            throw new ApiException(400, "Amount must be a whole number");
        }
        boolean set = "set".equals(String.valueOf(body.get("mode")));
        long next = set ? amount : (long) u.getPixels() + amount;
        if (next < 0 || next > 100_000_000L) {
            throw new ApiException(400, "Balance must stay between 0 and 100,000,000");
        }
        u.setPixels((int) next);
        return ResponseEntity.ok(view(users.save(u)));
    }

    private static Map<String, Object> view(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("rating", u.getRating());
        m.put("pixels", u.getPixels());
        return m;
    }
}
