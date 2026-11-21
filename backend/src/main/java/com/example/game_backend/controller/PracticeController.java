package com.example.game_backend.controller;

import com.example.game_backend.dto.SubmitRequest;
import com.example.game_backend.entity.Challenge;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.ChallengeEvaluator;
import com.example.game_backend.game.EvalResult;
import com.example.game_backend.i18n.ChallengeText;
import com.example.game_backend.i18n.Lang;
import com.example.game_backend.i18n.ServerText;
import com.example.game_backend.repository.ChallengeRepository;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Practice with real challenges: the doors of a solo run ask for code, checked by the same sandbox as in a match.
 * Nothing is recorded (no rating, no PIXELS, no statistics).
 */
@RestController
@RequestMapping("/api/practice")
public class PracticeController {
    private static final int MAX_SOURCE_CHARS = 20000;
    private static final long MIN_GAP_MS = 1500;

    private final ChallengeRepository challenges;
    private final ChallengeEvaluator evaluator;
    private final TokenService tokens;
    private final Map<Long, Long> lastCheck = new ConcurrentHashMap<>();

    public PracticeController(ChallengeRepository challenges, ChallengeEvaluator evaluator, TokenService tokens) {
        this.challenges = challenges;
        this.evaluator = evaluator;
        this.tokens = tokens;
    }

    /** A random public challenge of this level (EASY / MEDIUM / HARD), avoiding the ids in `exclude`. */
    @GetMapping("/challenge")
    public ResponseEntity<Map<String, Object>> pick(@RequestParam(defaultValue = "EASY") String difficulty,
                                                    @RequestParam(defaultValue = "") String exclude,
                                                    @RequestParam(defaultValue = "1") int cp,
                                                    @RequestHeader(value = "Authorization", required = false) String auth) {
        tokens.requireUserId(auth);
        String level = difficulty.trim().toUpperCase();
        if (!Set.of("EASY", "MEDIUM", "HARD").contains(level)) {
            throw new ApiException(400, "Difficulty must be EASY, MEDIUM or HARD");
        }
        Set<Long> skip = new HashSet<>();
        for (String s : exclude.split(",")) {
            try {
                skip.add(Long.parseLong(s.trim()));
            } catch (NumberFormatException ignored) {
                // empty or junk: nothing to skip
            }
        }
        List<Challenge> pool = new ArrayList<>();
        List<Challenge> fallback = new ArrayList<>();
        for (Challenge c : challenges.findByPublishedTrueAndDifficulty(level)) {
            if (c.getOwnerId() == null) {
                (skip.contains(c.getId()) ? fallback : pool).add(c);
            }
        }
        if (pool.isEmpty()) {
            pool = fallback;
        }
        if (pool.isEmpty()) {
            throw new ApiException(404, "No challenges of this level yet");
        }
        Challenge c = pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("challengeId", c.getId());
        m.put("cpNum", Math.max(1, Math.min(4, cp)));
        m.put("title", c.getTitle());
        m.put("difficulty", c.getDifficulty());
        m.put("description", c.getDescription());
        m.put("inputDescription", c.getInputDescription());
        m.put("outputDescription", c.getOutputDescription());
        m.put("functionName", c.getFunctionName());
        m.put("initialCode", c.getStarterCode());
        m.put("examples", c.getExamples() == null ? List.of() : List.of(c.getExamples().split("\n")));
        m.put("secondsRemaining", 0);
        ChallengeText.localize(m, Lang.current());
        return ResponseEntity.ok(m);
    }

    @PostMapping("/challenge/{id}/check")
    public ResponseEntity<Map<String, Object>> check(@PathVariable long id, @RequestBody SubmitRequest body,
                                                     @RequestHeader(value = "Authorization", required = false) String auth) {
        long uid = tokens.requireUserId(auth);
        String source = body == null ? null : body.code;
        if (source == null || source.isBlank()) {
            throw new ApiException(400, "Write some code first");
        }
        if (source.length() > MAX_SOURCE_CHARS) {
            throw new ApiException(400, "Solution is too long");
        }
        Challenge c = challenges.findById(id).filter(x -> x.isPublished() && x.getOwnerId() == null)
                .orElseThrow(() -> new ApiException(404, "Challenge not found"));
        long now = System.currentTimeMillis();
        Long prev = lastCheck.put(uid, now);
        if (prev != null && now - prev < MIN_GAP_MS) {
            throw new ApiException(429, "Slow down: wait a second between submissions");
        }
        if (lastCheck.size() > 10_000) {
            lastCheck.values().removeIf(t -> now - t > 60_000);
        }
        EvalResult r = evaluator.evaluate(source, c.getFunctionName(), c.getTestsJson());
        Map<String, Object> m = r.toMap();
        if (m.get("errorMessage") instanceof String msg) {
            m.put("errorMessage", ServerText.tr(msg));
        }
        m.put("unlocked", r.passed);
        m.put("matchOver", false);
        m.put("secondsRemaining", 0);
        return ResponseEntity.ok(m);
    }
}
