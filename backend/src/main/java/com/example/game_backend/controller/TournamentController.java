package com.example.game_backend.controller;

import com.example.game_backend.security.TokenService;
import com.example.game_backend.tournament.TournamentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class TournamentController {
    private final TournamentService tournament;
    private final TokenService tokens;

    public TournamentController(TournamentService tournament, TokenService tokens) {
        this.tournament = tournament;
        this.tokens = tokens;
    }

    /** Standings of the running (or coming) weekend tournament and last weekend's winners. Login optional. */
    @GetMapping("/api/tournament")
    public ResponseEntity<Map<String, Object>> view(@RequestHeader(value = "Authorization", required = false) String auth) {
        Long me = null;
        if (auth != null && auth.regionMatches(true, 0, "Bearer ", 0, 7)) {
            me = tokens.verify(auth.substring(7).trim());
        }
        return ResponseEntity.ok(tournament.view(me));
    }
}
