package com.example.game_backend.controller;

import com.example.game_backend.security.TokenService;
import com.example.game_backend.service.MatchmakingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/matchmaking")
public class MatchmakingController {
    private final MatchmakingService matchmaking;
    private final TokenService tokens;

    public MatchmakingController(MatchmakingService matchmaking, TokenService tokens) {
        this.matchmaking = matchmaking;
        this.tokens = tokens;
    }

    @PostMapping("/join")
    public ResponseEntity<Map<String, Object>> join(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(matchmaking.join(tokens.requireUserId(auth)));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(matchmaking.status(tokens.requireUserId(auth)));
    }

    @PostMapping("/cancel")
    public ResponseEntity<Map<String, Object>> cancel(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(matchmaking.cancel(tokens.requireUserId(auth)));
    }
}
