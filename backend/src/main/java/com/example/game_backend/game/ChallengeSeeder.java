package com.example.game_backend.game;

import com.example.game_backend.entity.Challenge;
import com.example.game_backend.repository.ChallengeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * Publishes the built-in challenge catalog (resources/challenges/catalog.json). Every start adds the catalog
 * entries whose title is not in the database yet, so existing installations receive new challenges too;
 * challenges an admin edited or withdrew are left alone. Each entry carries a reference solution that
 * ChallengeCatalogTest runs through the real evaluator, so a wrong expected value never ships.
 */
@Component
public class ChallengeSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(ChallengeSeeder.class);
    static final String CATALOG = "/challenges/catalog.json";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final ChallengeRepository repository;

    public ChallengeSeeder(ChallengeRepository repository) {
        this.repository = repository;
    }

    /** One catalog entry, as stored in catalog.json. */
    public record Entry(String title, String difficulty, String description, String inputDescription,
                        String outputDescription, String functionName, String params, String examples,
                        List<Map<String, Object>> tests, String referenceSolution) {
        public String testsJson() {
            return JSON.writeValueAsString(tests);
        }

        public String starterCode() {
            return JavaStarter.buildWithNames(functionName, testsJson(), params);
        }
    }

    public static List<Entry> catalog() {
        try (InputStream in = ChallengeSeeder.class.getResourceAsStream(CATALOG)) {
            if (in == null) {
                throw new IllegalStateException(CATALOG + " is missing");
            }
            return List.of(JSON.readValue(in, Entry[].class));
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read " + CATALOG, e);
        }
    }

    @Override
    public void run(ApplicationArguments args) {
        int added = 0;
        for (Entry e : catalog()) {
            if (repository.existsByTitle(e.title())) {
                continue;
            }
            Challenge c = new Challenge();
            c.setTitle(e.title());
            c.setDescription(e.description());
            c.setInputDescription(e.inputDescription());
            c.setOutputDescription(e.outputDescription());
            c.setFunctionName(e.functionName());
            c.setStarterCode(e.starterCode());
            c.setExamples(e.examples());
            c.setTestsJson(e.testsJson());
            c.setDifficulty(e.difficulty());
            c.setPublished(true);
            repository.save(c);
            added++;
        }
        if (added > 0) {
            log.info("Added {} challenge(s) from the built-in catalog", added);
        }
    }
}
