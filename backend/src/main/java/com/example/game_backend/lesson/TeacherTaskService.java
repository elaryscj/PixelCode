package com.example.game_backend.lesson;

import com.example.game_backend.entity.Challenge;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.ChallengeEvaluator;
import com.example.game_backend.game.ChallengeSeeder;
import com.example.game_backend.game.EvalResult;
import com.example.game_backend.game.JavaStarter;
import com.example.game_backend.repository.ChallengeRepository;
import com.example.game_backend.security.RateLimiter;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * A teacher's own tasks for their class. Like an admin's challenge (the reference solution must pass every
 * test before it is saved), but private: owned by the teacher, never published, so they appear only in that
 * teacher's lesson form and never in public matches.
 */
@Service
public class TeacherTaskService {
    private static final Pattern IDENT = Pattern.compile("^[A-Za-z_$][A-Za-z0-9_$]{0,40}$");
    private static final Set<String> LEVELS = Set.of("EASY", "MEDIUM", "HARD");
    static final int MAX_TASKS = 200;

    public record Form(String title, String difficulty, String description, String inputDescription,
                       String outputDescription, String functionName, String examples, String testsJson,
                       String referenceSolution) {
    }

    private final ChallengeRepository challenges;
    private final ChallengeEvaluator evaluator;
    private final LessonService lessons;
    private final RateLimiter limiter;

    public TeacherTaskService(ChallengeRepository challenges, ChallengeEvaluator evaluator, LessonService lessons,
                              RateLimiter limiter) {
        this.challenges = challenges;
        this.evaluator = evaluator;
        this.lessons = lessons;
        this.limiter = limiter;
    }

    public List<Map<String, Object>> mine(long userId) {
        lessons.requireAnyTeacher(userId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Challenge c : challenges.findByOwnerIdOrderByIdDesc(userId)) {
            out.add(view(c));
        }
        return out;
    }

    public Map<String, Object> create(long userId, Form f) {
        lessons.requireTeacher(userId);
        if (challenges.countByOwnerId(userId) >= MAX_TASKS) {
            throw new ApiException(409, "You have too many tasks");
        }
        Challenge c = new Challenge();
        c.setOwnerId(userId);
        c.setPublished(false);
        fill(userId, c, f);
        return view(challenges.save(c));
    }

    public Map<String, Object> update(long userId, long id, Form f) {
        lessons.requireTeacher(userId);
        Challenge c = challenges.findById(id)
                .filter(x -> Objects.equals(x.getOwnerId(), userId))
                .orElseThrow(() -> new ApiException(404, "Task not found"));
        fill(userId, c, f);
        return view(challenges.save(c));
    }

    private void fill(long userId, Challenge c, Form f) {
        // every save runs the reference solution in the Java checker
        limiter.hit("teacher-task:" + userId, 60, 3600);
        String title = trim(f.title());
        if (title.isEmpty() || title.length() > 80) {
            throw new ApiException(400, "Give the task a title (up to 80 characters)").with("field", "title");
        }
        boolean renamed = !title.equals(c.getTitle());
        // catalog titles are reserved: the seeder recognises its tasks by title
        if (renamed && (challenges.existsByTitle(title) || catalogTitles().contains(title))) {
            throw new ApiException(409, "A task with this title already exists").with("field", "title");
        }
        String description = trim(f.description());
        if (description.isEmpty() || description.length() > 4000) {
            throw new ApiException(400, "Describe the task").with("field", "description");
        }
        String level = trim(f.difficulty()).toUpperCase(Locale.ROOT);
        if (level.isEmpty()) {
            level = "EASY";
        }
        if (!LEVELS.contains(level)) {
            throw new ApiException(400, "Difficulty must be EASY, MEDIUM or HARD").with("field", "difficulty");
        }
        String fn = trim(f.functionName());
        if (!IDENT.matcher(fn).matches()) {
            throw new ApiException(400, "The method name must be a Java name, for example solve").with("field", "functionName");
        }
        String tests = trim(f.testsJson());
        if (tests.isEmpty() || tests.length() > 20_000) {
            throw new ApiException(400, "Add tests").with("field", "testsJson");
        }
        String ref = f.referenceSolution() == null ? "" : f.referenceSolution();
        if (ref.isBlank()) {
            throw new ApiException(400, "Write a reference solution").with("field", "referenceSolution");
        }
        EvalResult check = evaluator.evaluate(ref, fn, tests);
        if (check.errorMessage != null) {
            throw new ApiException(400, "Reference solution failed: " + check.errorMessage).with("field", "referenceSolution");
        }
        if (!check.passed) {
            throw new ApiException(400, "Reference solution passes only " + check.passedCount + " of " + check.total + " tests")
                    .with("field", "testsJson");
        }
        c.setTitle(title);
        c.setDifficulty(level);
        c.setDescription(description);
        c.setInputDescription(cap(f.inputDescription(), 1000));
        c.setOutputDescription(cap(f.outputDescription(), 1000));
        c.setFunctionName(fn);
        c.setExamples(cap(f.examples(), 2000));
        c.setTestsJson(tests);
        c.setStarterCode(JavaStarter.build(fn, tests, null));
        c.setReferenceSolution(ref);
    }

    private static Set<String> catalogTitles() {
        Set<String> s = new HashSet<>();
        for (ChallengeSeeder.Entry e : ChallengeSeeder.catalog()) {
            s.add(e.title());
        }
        return s;
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static String cap(String s, int max) {
        String t = trim(s);
        return t.length() > max ? t.substring(0, max) : t;
    }

    static Map<String, Object> view(Challenge c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("title", c.getTitle());
        m.put("difficulty", c.getDifficulty());
        m.put("description", c.getDescription());
        m.put("inputDescription", c.getInputDescription());
        m.put("outputDescription", c.getOutputDescription());
        m.put("functionName", c.getFunctionName());
        m.put("examples", c.getExamples());
        m.put("testsJson", c.getTestsJson());
        m.put("referenceSolution", c.getReferenceSolution());
        return m;
    }
}
