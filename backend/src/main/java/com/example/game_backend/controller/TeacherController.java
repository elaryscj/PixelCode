package com.example.game_backend.controller;

import com.example.game_backend.lesson.TeacherAccessService;
import com.example.game_backend.security.TokenService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Teacher mode for the logged-in player: status, free trial, subscription request. */
@RestController
@RequestMapping("/api/teacher")
public class TeacherController {
    private final TeacherAccessService access;
    private final TokenService tokens;

    public TeacherController(TeacherAccessService access, TokenService tokens) {
        this.access = access;
        this.tokens = tokens;
    }

    @GetMapping("/status")
    public Map<String, Object> status(@RequestHeader(value = "Authorization", required = false) String auth) {
        return access.status(tokens.requireUserId(auth));
    }

    @PostMapping("/trial")
    public Map<String, Object> trial(@RequestHeader(value = "Authorization", required = false) String auth) {
        return access.startTrial(tokens.requireUserId(auth));
    }

    public record RequestBody(String plan, String school, String contact, String note) {
    }

    @PostMapping("/request")
    public Map<String, Object> request(@org.springframework.web.bind.annotation.RequestBody RequestBody body,
                                       @RequestHeader(value = "Authorization", required = false) String auth) {
        return access.request(tokens.requireUserId(auth), body.plan(), body.school(), body.contact(), body.note());
    }
}
