package com.example.game_backend.controller;

import com.example.game_backend.i18n.ChallengeText;
import com.example.game_backend.i18n.Lang;
import com.example.game_backend.security.AdminAccess;
import com.example.game_backend.security.TokenService;
import com.example.game_backend.stats.DoorStatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Challenge balancing numbers (admin) and the best solutions of a challenge (players who met it). */
@RestController
public class DoorStatsController {
    private final DoorStatsService stats;
    private final TokenService tokens;
    private final AdminAccess admins;

    public DoorStatsController(DoorStatsService stats, TokenService tokens, AdminAccess admins) {
        this.stats = stats;
        this.tokens = tokens;
        this.admins = admins;
    }

    @GetMapping("/api/admin/stats")
    public ResponseEntity<Map<String, Object>> adminStats(@RequestParam(defaultValue = "30") int days,
                                                          @RequestHeader(value = "Authorization", required = false) String auth) {
        admins.require(auth);
        return ResponseEntity.ok(stats.adminStats(days));
    }

    @GetMapping("/api/solutions/match/{code}")
    public ResponseEntity<List<Map<String, Object>>> doorsOfMatch(@PathVariable String code,
                                                                  @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(stats.doorsOfMatch(code, tokens.requireUserId(auth)));
    }

    @GetMapping("/api/solutions/{challengeId}")
    public ResponseEntity<Map<String, Object>> best(@PathVariable long challengeId,
                                                    @RequestHeader(value = "Authorization", required = false) String auth) {
        Map<String, Object> m = stats.bestSolutions(challengeId, tokens.requireUserId(auth));
        ChallengeText.localize(m, Lang.current());
        return ResponseEntity.ok(m);
    }
}
