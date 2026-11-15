package com.example.game_backend.game;

import com.example.game_backend.entity.Challenge;
import com.example.game_backend.repository.ChallengeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Challenges used to be solved in JavaScript. Their tests are language-neutral JSON, so on start-up every
 * challenge that still has a JavaScript starter gets a Java one (types inferred from the tests, parameter
 * names kept). Runs after the seeder; does nothing once everything is Java.
 */
@Component
@Order(10)
public class ChallengeJavaMigration implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(ChallengeJavaMigration.class);
    private final ChallengeRepository repository;

    public ChallengeJavaMigration(ChallengeRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(ApplicationArguments args) {
        int converted = 0;
        for (Challenge c : repository.findAll()) {
            if (!JavaStarter.isJavaScript(c.getStarterCode())) {
                continue;
            }
            c.setStarterCode(JavaStarter.build(c.getFunctionName(), c.getTestsJson(), c.getStarterCode()));
            if (c.getDescription() != null) {
                c.setDescription(c.getDescription().replace("Write a function `", "Write a method `"));
            }
            repository.save(c);
            converted++;
        }
        if (converted > 0) {
            log.info("Converted {} challenge(s) from JavaScript to Java starter code", converted);
        }
    }
}
