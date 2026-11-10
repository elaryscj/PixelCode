package com.example.game_backend.controller;

import com.example.game_backend.dto.SubmitRequest;
import com.example.game_backend.game.GameService;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/games")
public class GameController {
    private final GameService games;
    private final TokenService tokens;

    public GameController(GameService games, TokenService tokens) {
        this.games = games;
        this.tokens = tokens;
    }

    @GetMapping("/{code}")
    public ResponseEntity<Map<String, Object>> state(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(games.state(code.toUpperCase(), tokens.requireUserId(auth)));
    }

    @PostMapping("/{code}/doors/{cp}/open")
    public ResponseEntity<Map<String, Object>> open(@PathVariable String code, @PathVariable int cp, @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(games.openDoor(code.toUpperCase(), tokens.requireUserId(auth), cp));
    }

    @PostMapping("/{code}/doors/{cp}/submit")
    public ResponseEntity<Map<String, Object>> submit(@PathVariable String code, @PathVariable int cp,
                                                      @RequestBody SubmitRequest body, @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(games.submit(code.toUpperCase(), tokens.requireUserId(auth), cp, body == null ? null : body.code));
    }

    @PostMapping("/{code}/finish")
    public ResponseEntity<Map<String, Object>> finish(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(games.finish(code.toUpperCase(), tokens.requireUserId(auth)));
    }
}
