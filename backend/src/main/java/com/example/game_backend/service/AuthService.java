package com.example.game_backend.service;

import com.example.game_backend.dto.AuthRequest;
import com.example.game_backend.dto.AuthResponse;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

@Service
public class AuthService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9_]{2,16}$");

    private final UserRepository users;
    private final TokenService tokens;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    private final MailService mail;

    public AuthService(UserRepository users, TokenService tokens, MailService mail) {
        this.users = users;
        this.tokens = tokens;
        this.mail = mail;
    }

    /** Forgot password: always silent about whether the e-mail exists. */
    public void forgotPassword(String emailRaw) {
        String email = emailRaw == null ? "" : emailRaw.trim();
        if (!EMAIL.matcher(email).matches()) {
            throw new ApiException(400, "Enter a valid e-mail address").with("field", "email");
        }
        users.findByEmailIgnoreCase(email).ifPresent(u -> mail.sendResetLink(u, tokens.issueReset(u.getId(), u.getPassword())));
    }

    public void resetPassword(String token, String password) {
        if (password == null || password.length() < 12 || password.length() > 72) {
            throw new ApiException(400, "Password must be at least 12 characters").with("field", "password");
        }
        if (!password.matches(".*[a-z].*") || !password.matches(".*[A-Z].*") || !password.matches(".*\\d.*")) {
            throw new ApiException(400, "Include uppercase, lowercase and a number").with("field", "password");
        }
        long userId = tokens.userIdFromReset(token);
        User user = users.findById(userId).orElseThrow(() -> new ApiException(400, "This reset link is invalid or expired"));
        if (!tokens.resetValid(token, user.getPassword())) {
            throw new ApiException(400, "This reset link is invalid or expired");
        }
        if (encoder.matches(password, user.getPassword())) {
            throw new ApiException(400, "Use a password you haven't used before").with("field", "password");
        }
        user.setPassword(encoder.encode(password));
        users.save(user);
    }

    /** US-01 */
    public AuthResponse register(AuthRequest req) {
        String username = req.getUsername() == null ? "" : req.getUsername().trim();
        String password = req.getPassword() == null ? "" : req.getPassword();
        if (!USERNAME.matcher(username).matches()) {
            throw new ApiException(400, "Username must be 2-16 characters: letters, digits or underscore")
                    .with("field", "username");
        }
        if (password.length() < 8 || password.length() > 72) {
            throw new ApiException(400, "Password must be at least 8 characters").with("field", "password");
        }
        String email = req.getEmail() == null ? "" : req.getEmail().trim();
        if (!EMAIL.matcher(email).matches() || email.length() > 120) {
            throw new ApiException(400, "Enter a valid e-mail address").with("field", "email");
        }
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ApiException(409, "This e-mail is already registered").with("field", "email");
        }
        if (users.existsByUsernameIgnoreCase(username)) {
            throw new ApiException(409, "Username is already in use").with("field", "username");
        }
        User created = new User(username, encoder.encode(password));
        created.setEmail(email);
        User user = users.save(created);
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

    private AuthResponse toResponse(User user, String message) {
        return new AuthResponse(user.getId(), user.getUsername(), user.getRating(), message,
                tokens.issue(user.getId()), user.getWins(), user.getLosses(), tokens.isAdminUsername(user.getUsername()),
                user.getPixels(), user.getActiveSkin(), user.getAvatarUrl());
    }
}
