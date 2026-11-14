package com.example.game_backend.security;

import com.example.game_backend.error.ApiException;

import java.util.regex.Pattern;

/** One set of rules for usernames, e-mails and passwords, used by register, profile edit and reset. */
public final class AccountRules {
    public static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9_]{2,16}$");
    public static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    private AccountRules() {
    }

    public static String username(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (!USERNAME.matcher(name).matches()) {
            throw new ApiException(400, "Username must be 2-16 characters: letters, digits or underscore").with("field", "username");
        }
        return name;
    }

    public static String email(String raw) {
        String email = raw == null ? "" : raw.trim();
        if (!EMAIL.matcher(email).matches() || email.length() > 120) {
            throw new ApiException(400, "Enter a valid e-mail address").with("field", "email");
        }
        return email;
    }

    /** 8-72 characters (bcrypt reads at most 72 bytes) with at least one letter and one digit. */
    public static void password(String pw, String field) {
        if (pw == null || pw.length() < 8 || pw.length() > 72) {
            throw new ApiException(400, "Password must be 8-72 characters").with("field", field);
        }
        if (!pw.matches("(?s).*[A-Za-z].*") || !pw.matches("(?s).*\\d.*")) {
            throw new ApiException(400, "Password must contain a letter and a number").with("field", field);
        }
    }
}
