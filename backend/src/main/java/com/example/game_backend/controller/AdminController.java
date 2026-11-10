package com.example.game_backend.controller;

import com.example.game_backend.entity.Challenge;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.ChallengeEvaluator;
import com.example.game_backend.game.EvalResult;
import com.example.game_backend.repository.ChallengeRepository;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** US-22 / US-23: administrators maintain the challenge catalog. */
@RestController
@RequestMapping("/api/admin/challenges")
public class AdminController {
    private static final Pattern IDENT = Pattern.compile("^[A-Za-z_$][A-Za-z0-9_$]{0,40}$");

    public static class ChallengeForm {
        public String title, description, inputDescription, outputDescription, functionName,
                starterCode, examples, testsJson, referenceSolution;
    }

    private final ChallengeRepository challenges;
    private final UserRepository users;
    private final TokenService tokens;
    private final ChallengeEvaluator evaluator;

    public AdminController(ChallengeRepository challenges, UserRepository users, TokenService tokens,
                           ChallengeEvaluator evaluator) {
        this.challenges = challenges;
        this.users = users;
        this.tokens = tokens;
        this.evaluator = evaluator;
    }

    private void requireAdmin(String auth) {
        long id = tokens.requireUserId(auth);
        User u = users.findById(id).orElseThrow(() -> new ApiException(401, "Please log in again"));
        if (!tokens.isAdminUsername(u.getUsername())) {
            throw new ApiException(403, "Administrator access required");
        }
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(@RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Challenge c : challenges.findAllByOrderByIdDesc()) {
            out.add(view(c));
        }
        return ResponseEntity.ok(out);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody ChallengeForm f, @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        require(f.title, "title");
        require(f.description, "description");
        require(f.functionName, "functionName");
        require(f.testsJson, "testsJson");
        require(f.referenceSolution, "referenceSolution");
        if (!IDENT.matcher(f.functionName.trim()).matches()) {
            throw new ApiException(400, "Function name is not a valid identifier").with("field", "functionName");
        }
        EvalResult check = evaluator.evaluate(f.referenceSolution, f.functionName.trim(), f.testsJson);
        if (check.errorMessage != null) {
            throw new ApiException(400, "Reference solution failed: " + check.errorMessage).with("field", "referenceSolution");
        }
        if (!check.passed) {
            throw new ApiException(400, "Reference solution passes only " + check.passedCount + " of " + check.total
                    + " tests - fix the tests or the solution").with("field", "testsJson");
        }
        Challenge c = new Challenge();
        c.setTitle(f.title.trim());
        c.setDescription(f.description.trim());
        c.setInputDescription(f.inputDescription);
        c.setOutputDescription(f.outputDescription);
        c.setFunctionName(f.functionName.trim());
        c.setStarterCode(f.starterCode == null || f.starterCode.isBlank()
                ? "function " + f.functionName.trim() + "() {\n  // TODO\n\n}\n" : f.starterCode);
        c.setExamples(f.examples);
        c.setTestsJson(f.testsJson);
        c.setDifficulty("EASY");
        c.setPublished(true);
        return ResponseEntity.ok(view(challenges.save(c)));
    }

    @PostMapping("/{id}/withdraw")
    public ResponseEntity<Map<String, Object>> withdraw(@PathVariable long id, @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        Challenge c = challenges.findById(id).orElseThrow(() -> new ApiException(404, "Challenge not found"));
        c.setPublished(false);
        return ResponseEntity.ok(view(challenges.save(c)));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<Map<String, Object>> publish(@PathVariable long id, @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        Challenge c = challenges.findById(id).orElseThrow(() -> new ApiException(404, "Challenge not found"));
        c.setPublished(true);
        return ResponseEntity.ok(view(challenges.save(c)));
    }

    private static void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new ApiException(400, "Field '" + field + "' is required").with("field", field);
        }
    }

    private static Map<String, Object> view(Challenge c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("title", c.getTitle());
        m.put("description", c.getDescription());
        m.put("functionName", c.getFunctionName());
        m.put("difficulty", c.getDifficulty());
        m.put("published", c.isPublished());
        return m;
    }
}
