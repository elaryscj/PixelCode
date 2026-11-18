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
    private final com.example.game_backend.payment.PaymentService payments;

    public TeacherController(TeacherAccessService access, TokenService tokens,
                             com.example.game_backend.payment.PaymentService payments) {
        this.access = access;
        this.tokens = tokens;
        this.payments = payments;
    }

    /** No login needed: the public offer quotes these prices. */
    @GetMapping("/plans")
    public Map<String, Object> plans() {
        return access.plans();
    }

    @GetMapping("/status")
    public Map<String, Object> status(@RequestHeader(value = "Authorization", required = false) String auth) {
        Map<String, Object> m = access.status(tokens.requireUserId(auth));
        m.put("onlinePayment", payments.enabled());
        return m;
    }

    @PostMapping("/trial")
    public Map<String, Object> trial(@RequestHeader(value = "Authorization", required = false) String auth) {
        Map<String, Object> m = access.startTrial(tokens.requireUserId(auth));
        m.put("onlinePayment", payments.enabled());
        return m;
    }

    public record RequestBody(String plan, String school, String contact, String note) {
    }

    @PostMapping("/request")
    public Map<String, Object> request(@org.springframework.web.bind.annotation.RequestBody RequestBody body,
                                       @RequestHeader(value = "Authorization", required = false) String auth) {
        Map<String, Object> m = access.request(tokens.requireUserId(auth), body.plan(), body.school(), body.contact(), body.note());
        m.put("onlinePayment", payments.enabled());
        return m;
    }
}
