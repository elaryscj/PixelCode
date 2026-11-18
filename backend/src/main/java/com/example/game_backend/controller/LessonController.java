package com.example.game_backend.controller;

import com.example.game_backend.i18n.ChallengeText;
import com.example.game_backend.i18n.Lang;
import com.example.game_backend.i18n.ServerText;
import com.example.game_backend.lesson.LessonService;
import com.example.game_backend.lesson.TeacherTaskService;
import com.example.game_backend.security.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Teacher mode. Teachers use their normal login (Authorization); students have no account and send the
 * token they got when joining in the X-Lesson-Token header.
 */
@RestController
@RequestMapping("/api/lessons")
public class LessonController {
    private final LessonService lessons;
    private final TeacherTaskService tasks;
    private final TokenService tokens;

    public LessonController(LessonService lessons, TeacherTaskService tasks, TokenService tokens) {
        this.lessons = lessons;
        this.tasks = tasks;
        this.tokens = tokens;
    }

    // ------------------------------------------------------------------ a teacher's own tasks

    @GetMapping("/tasks")
    public List<Map<String, Object>> myTasks(@RequestHeader(value = "Authorization", required = false) String auth) {
        return tasks.mine(tokens.requireUserId(auth));
    }

    @PostMapping("/tasks")
    public Map<String, Object> createTask(@RequestBody TeacherTaskService.Form body,
                                          @RequestHeader(value = "Authorization", required = false) String auth) {
        return tasks.create(tokens.requireUserId(auth), body);
    }

    @PutMapping("/tasks/{id}")
    public Map<String, Object> updateTask(@PathVariable long id, @RequestBody TeacherTaskService.Form body,
                                          @RequestHeader(value = "Authorization", required = false) String auth) {
        return tasks.update(tokens.requireUserId(auth), id, body);
    }

    // ------------------------------------------------------------------ teacher

    @GetMapping
    public List<Map<String, Object>> mine(@RequestHeader(value = "Authorization", required = false) String auth) {
        return lessons.mine(tokens.requireUserId(auth));
    }

    @GetMapping("/catalog")
    public List<Map<String, Object>> catalog(@RequestHeader(value = "Authorization", required = false) String auth) {
        List<Map<String, Object>> list = lessons.catalog(tokens.requireUserId(auth));
        String lang = Lang.current();
        list.forEach(m -> ChallengeText.localize(m, lang));
        list.forEach(m -> {
            m.remove("inputDescription");
            m.remove("outputDescription");
        });
        return list;
    }

    public record CreateRequest(String title, Integer mapId, List<Long> challengeIds, Integer durationMinutes) {
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody CreateRequest body,
                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        return lessons.create(tokens.requireUserId(auth), body.title(), body.mapId(), body.challengeIds(), body.durationMinutes());
    }

    @GetMapping("/{code}/board")
    public Map<String, Object> board(@PathVariable String code,
                                     @RequestHeader(value = "Authorization", required = false) String auth) {
        return lessons.board(tokens.requireUserId(auth), code);
    }

    @GetMapping("/{code}/students/{id}")
    public Map<String, Object> studentWork(@PathVariable String code, @PathVariable long id,
                                           @RequestHeader(value = "Authorization", required = false) String auth) {
        Map<String, Object> work = lessons.studentWork(tokens.requireUserId(auth), code, id);
        if (work.get("submissions") instanceof List<?> subs) {
            for (Object o : subs) {
                if (o instanceof Map<?, ?> raw && raw.get("error") instanceof String msg) {
                    @SuppressWarnings("unchecked") Map<String, Object> m = (Map<String, Object>) raw;
                    m.put("error", ServerText.tr(msg));
                }
            }
        }
        return work;
    }

    @PostMapping("/{code}/start")
    public Map<String, Object> start(@PathVariable String code,
                                     @RequestHeader(value = "Authorization", required = false) String auth) {
        return lessons.start(tokens.requireUserId(auth), code);
    }

    @PostMapping("/{code}/end")
    public Map<String, Object> end(@PathVariable String code,
                                   @RequestHeader(value = "Authorization", required = false) String auth) {
        return lessons.end(tokens.requireUserId(auth), code);
    }

    // ------------------------------------------------------------------ students

    public record JoinRequest(String name) {
    }

    @PostMapping("/{code}/join")
    public Map<String, Object> join(@PathVariable String code, @RequestBody JoinRequest body, HttpServletRequest req) {
        return lessons.join(code, body == null ? null : body.name(), req.getRemoteAddr());
    }

    /** ?falls=n lets the student report how often they fell (shown to the teacher). */
    @GetMapping("/{code}/me")
    public Map<String, Object> me(@PathVariable String code, @RequestParam(required = false) Integer falls,
                                  @RequestHeader(value = "X-Lesson-Token", required = false) String token) {
        return lessons.me(code, token, falls);
    }

    @PostMapping("/{code}/doors/{door}/open")
    public Map<String, Object> open(@PathVariable String code, @PathVariable int door,
                                    @RequestHeader(value = "X-Lesson-Token", required = false) String token) {
        Map<String, Object> view = lessons.openDoor(code, token, door);
        ChallengeText.localize(view, Lang.current());
        return view;
    }

    public record SubmitBody(String code) {
    }

    @PostMapping("/{code}/doors/{door}/submit")
    public Map<String, Object> submit(@PathVariable String code, @PathVariable int door, @RequestBody SubmitBody body,
                                      @RequestHeader(value = "X-Lesson-Token", required = false) String token) {
        Map<String, Object> result = lessons.submit(code, token, door, body == null ? null : body.code());
        if (result.get("errorMessage") instanceof String msg) {
            result.put("errorMessage", ServerText.tr(msg));
        }
        return result;
    }

    @PostMapping("/{code}/finish")
    public Map<String, Object> finish(@PathVariable String code,
                                      @RequestHeader(value = "X-Lesson-Token", required = false) String token) {
        return lessons.finish(code, token);
    }
}
