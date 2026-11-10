package com.example.game_backend.controller;

import com.example.game_backend.dto.AuthRequest;
import com.example.game_backend.dto.AuthResponse;
import com.example.game_backend.security.TokenService;
import com.example.game_backend.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final TokenService tokens;

    public AuthController(AuthService authService, TokenService tokens) {
        this.authService = authService;
        this.tokens = tokens;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/forgot")
    public ResponseEntity<java.util.Map<String, String>> forgot(@RequestBody java.util.Map<String, String> body) {
        authService.forgotPassword(body.get("email"));
        return ResponseEntity.ok(java.util.Map.of("message", "If an account exists, a reset link was sent"));
    }

    @PostMapping("/reset")
    public ResponseEntity<java.util.Map<String, String>> reset(@RequestBody java.util.Map<String, String> body) {
        authService.resetPassword(body.get("token"), body.get("password"));
        return ResponseEntity.ok(java.util.Map.of("message", "Password updated"));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(authService.me(tokens.requireUserId(auth)));
    }
}
