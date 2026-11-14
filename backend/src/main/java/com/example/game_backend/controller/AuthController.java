package com.example.game_backend.controller;

import com.example.game_backend.dto.AuthRequest;
import com.example.game_backend.dto.AuthResponse;
import com.example.game_backend.security.RateLimiter;
import com.example.game_backend.security.TokenService;
import com.example.game_backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final TokenService tokens;
    private final RateLimiter limiter;
    private final int registerPerHour;
    private final int loginPerAccount;
    private final int loginPerIp;
    private final int resetMailsPerHour;

    public AuthController(AuthService authService, TokenService tokens, RateLimiter limiter,
                          @Value("${game.limits.register-per-hour:10}") int registerPerHour,
                          @Value("${game.limits.login-per-account:10}") int loginPerAccount,
                          @Value("${game.limits.login-per-ip:40}") int loginPerIp,
                          @Value("${game.limits.reset-mails-per-hour:3}") int resetMailsPerHour) {
        this.authService = authService;
        this.tokens = tokens;
        this.limiter = limiter;
        this.registerPerHour = registerPerHour;
        this.loginPerAccount = loginPerAccount;
        this.loginPerIp = loginPerIp;
        this.resetMailsPerHour = resetMailsPerHour;
    }

    /** Client IP; behind Render's proxy this comes from X-Forwarded-For (server.forward-headers-strategy). */
    private static String ip(HttpServletRequest req) {
        return req.getRemoteAddr();
    }

    private static String key(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody AuthRequest request, HttpServletRequest http) {
        limiter.hit("register-ip:" + ip(http), registerPerHour, 3600);
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request, HttpServletRequest http) {
        String userKey = "login-user:" + key(request.getUsername());
        limiter.hit("login-ip:" + ip(http), loginPerIp, 600); // one address trying many accounts
        limiter.hit(userKey, loginPerAccount, 900);           // many guesses at one account (15 min)
        AuthResponse res = authService.login(request);
        limiter.reset(userKey);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/forgot")
    public ResponseEntity<Map<String, String>> forgot(@RequestBody Map<String, String> body, HttpServletRequest http) {
        limiter.hit("forgot-ip:" + ip(http), 5, 900);
        limiter.hit("forgot-mail:" + key(body.get("email")), resetMailsPerHour, 3600); // no flooding of one inbox
        authService.forgotPassword(body.get("email"));
        return ResponseEntity.ok(Map.of("message", "If an account exists, a reset link was sent"));
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, String>> reset(@RequestBody Map<String, String> body, HttpServletRequest http) {
        limiter.hit("reset-ip:" + ip(http), 10, 900);
        authService.resetPassword(body.get("token"), body.get("password"));
        return ResponseEntity.ok(Map.of("message", "Password updated"));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(authService.me(tokens.requireUserId(auth)));
    }
}
