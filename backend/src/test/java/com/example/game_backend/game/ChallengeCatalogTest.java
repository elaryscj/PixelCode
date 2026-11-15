package com.example.game_backend.game;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Every built-in challenge must be solvable as published: its reference solution passes all tests in the real
 * evaluator, and the generated starter compiles and runs (so its parameter types fit the test data).
 */
class ChallengeCatalogTest {
    private final ChallengeEvaluator evaluator = new ChallengeEvaluator(3000, 4000, 4);

    @Test
    void everyChallengeIsSolvableAndItsStarterRuns() {
        List<ChallengeSeeder.Entry> catalog = ChallengeSeeder.catalog();
        List<String> problems = new ArrayList<>();
        Set<String> titles = new HashSet<>();
        for (ChallengeSeeder.Entry e : catalog) {
            if (!titles.add(e.title())) {
                problems.add(e.title() + ": duplicate title");
            }
            if (!Set.of("EASY", "MEDIUM", "HARD").contains(e.difficulty())) {
                problems.add(e.title() + ": unknown difficulty " + e.difficulty());
            }
            if (e.tests().size() < 4) {
                problems.add(e.title() + ": needs at least 4 tests");
            }
            EvalResult ref = evaluator.evaluate(e.referenceSolution(), e.functionName(), e.testsJson());
            if (ref.errorMessage != null || !ref.passed) {
                problems.add(e.title() + ": reference solution " + (ref.errorMessage != null ? ref.errorMessage
                        : "passes " + ref.passedCount + "/" + ref.total + " " + ref.details));
            }
            EvalResult starter = evaluator.evaluate(e.starterCode(), e.functionName(), e.testsJson());
            if (starter.errorMessage != null) {
                problems.add(e.title() + ": starter does not run: " + starter.errorMessage + "\n" + e.starterCode());
            }
        }
        assertTrue(problems.isEmpty(), String.join("\n", problems));
        assertTrue(catalog.stream().filter(e -> e.difficulty().equals("HARD")).count() >= 8, "too few HARD challenges");
    }
}
