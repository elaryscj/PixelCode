package com.example.game_backend.controller;

import com.example.game_backend.game.GameService;
import com.example.game_backend.security.TokenService;
import com.example.game_backend.service.MatchmakingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** Real numbers for the "players online" line in the menus (public, no login needed). */
@RestController
public class StatsController {
    private static final long ONLINE_WINDOW_MS = 5 * 60_000L;

    private final TokenService tokens;
    private final MatchmakingService matchmaking;
    private final GameService games;

    public StatsController(TokenService tokens, MatchmakingService matchmaking, GameService games) {
        this.tokens = tokens;
        this.matchmaking = matchmaking;
        this.games = games;
    }

    @GetMapping("/api/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("online", tokens.activeUsers(ONLINE_WINDOW_MS));
        m.put("inQueue", matchmaking.queueSize());
        m.put("activeMatches", games.activeMatches());
        return ResponseEntity.ok(m);
    }
}
