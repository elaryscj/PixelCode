package com.example.game_backend.controller;

import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.ReplayStore;
import com.example.game_backend.i18n.ChallengeText;
import com.example.game_backend.i18n.Lang;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** A recorded match, for its two players only (it contains both players' solutions). */
@RestController
public class ReplayController {
    private final ReplayStore replays;
    private final TokenService tokens;

    public ReplayController(ReplayStore replays, TokenService tokens) {
        this.replays = replays;
        this.tokens = tokens;
    }

    @GetMapping("/api/replays/{code}")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String code,
                                                   @RequestHeader(value = "Authorization", required = false) String auth) {
        long me = tokens.requireUserId(auth);
        Map<String, Object> data = replays.load(code.toUpperCase())
                .orElseThrow(() -> new ApiException(404, "Replay not found"));
        boolean played = ((List<Map<String, Object>>) data.get("players")).stream()
                .anyMatch(p -> p.get("userId") instanceof Number n && n.longValue() == me);
        if (!played) {
            throw new ApiException(403, "You did not play in this match");
        }
        // challenge texts in the viewer's language (titles stay English, like in the game)
        String lang = Lang.current();
        for (Map<String, Object> door : (List<Map<String, Object>>) data.get("doors")) {
            ChallengeText.localize(door, lang);
        }
        return ResponseEntity.ok(data);
    }
}
