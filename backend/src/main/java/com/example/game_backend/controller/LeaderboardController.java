package com.example.game_backend.controller;

import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/leaderboard")
public class LeaderboardController {
    private final UserRepository users;
    private final TokenService tokens;

    public LeaderboardController(UserRepository users, TokenService tokens) {
        this.users = users;
        this.tokens = tokens;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> top() {
        List<Map<String, Object>> out = new ArrayList<>();
        int place = 1;
        for (User u : users.findTop50ByOrderByRatingDescIdAsc()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("place", place++);
            m.put("id", u.getId());
            m.put("username", u.getUsername());
            m.put("rating", u.getRating());
            out.add(m);
        }
        return ResponseEntity.ok(out);
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@RequestHeader(value = "Authorization", required = false) String auth) {
        long id = tokens.requireUserId(auth);
        User u = users.findById(id).orElseThrow(() -> new ApiException(401, "Please log in again"));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("place", users.countByRatingGreaterThan(u.getRating()) + 1);
        m.put("username", u.getUsername());
        m.put("rating", u.getRating());
        m.put("wins", u.getWins());
        m.put("losses", u.getLosses());
        return ResponseEntity.ok(m);
    }
}
