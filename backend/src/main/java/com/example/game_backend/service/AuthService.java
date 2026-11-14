package com.example.game_backend.service;

import com.example.game_backend.dto.AuthRequest;
import com.example.game_backend.dto.AuthResponse;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.AccountRules;
import com.example.game_backend.security.AdminAccess;
import com.example.game_backend.security.TokenService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserRepository users;
    private final TokenService tokens;
    private final AdminAccess admins;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    private final MailService mail;

    public AuthService(UserRepository users, TokenService tokens, AdminAccess admins, MailService mail) {
        this.users = users;
        this.tokens = tokens;
        this.admins = admins;
        this.mail = mail;
    }

    /** Forgot password: always silent about whether the e-mail exists. */
    public void forgotPassword(String emailRaw) {
        String email = AccountRules.email(emailRaw);
        // older data can hold one e-mail on several accounts: send each account its own link
        for (User u : users.findAllByEmailIgnoreCase(email)) {
            mail.sendResetLink(u, tokens.issueReset(u.getId(), u.getPassword()));
        }
    }

    public void resetPassword(String token, String password) {
        AccountRules.password(password, "password");
        long userId = tokens.userIdFromReset(token);
        User user = users.findById(userId).orElseThrow(() -> new ApiException(400, "This reset link is invalid or expired"));
        if (!tokens.resetValid(token, user.getPassword())) {
            throw new ApiException(400, "This reset link is invalid or expired");
        }
        if (encoder.matches(password, user.getPassword())) {
            throw new ApiException(400, "Use a password you haven't used before").with("field", "password");
        }
        user.setPassword(encoder.encode(password));
        user.setTokenVersion(user.getTokenVersion() + 1); // signs out every existing session
        users.save(user);
        tokens.invalidate(user.getId());
    }

    /** US-01 */
    public AuthResponse register(AuthRequest req) {
        String username = AccountRules.username(req.getUsername());
        AccountRules.password(req.getPassword(), "password");
        String email = AccountRules.email(req.getEmail());
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ApiException(409, "This e-mail is already registered").with("field", "email");
        }
        if (users.existsByUsernameIgnoreCase(username)) {
            throw new ApiException(409, "Username is already in use").with("field", "username");
        }
        User created = new User(username, encoder.encode(req.getPassword()));
        created.setEmail(email);
        User user = users.save(created);
        admins.grantIfConfigured(user);
        mail.sendWelcome(user);
        return toResponse(user, "User created successfully");
    }

    /** US-02: one generic error for unknown user and wrong password. */
    public AuthResponse login(AuthRequest req) {
        String username = req.getUsername() == null ? "" : req.getUsername().trim();
        String password = req.getPassword() == null ? "" : req.getPassword();
        User user = users.findByUsernameIgnoreCase(username).orElse(null);
        if (user == null || !encoder.matches(password, user.getPassword())) {
            throw new ApiException(401, "Invalid username or password");
        }
        return toResponse(user, "Login successful");
    }

    public AuthResponse me(long userId) {
        User user = users.findById(userId).orElseThrow(() -> new ApiException(401, "Please log in again"));
        return toResponse(user, "OK");
    }

    public AuthResponse toResponse(User user, String message) {
        return new AuthResponse(user.getId(), user.getUsername(), user.getRating(), message,
                tokens.issue(user.getId(), user.getTokenVersion()), user.getWins(), user.getLosses(), user.isAdmin(),
                user.getPixels(), user.getActiveSkin(), user.getAvatarUrl());
    }
}
