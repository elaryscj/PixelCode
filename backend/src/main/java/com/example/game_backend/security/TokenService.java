package com.example.game_backend.security;

import com.example.game_backend.error.ApiException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Stateless signed session tokens: base64url("userId:expiry") + "." + base64url(HMAC-SHA256). */
@Component
public class TokenService {
    private static final Logger log = LoggerFactory.getLogger(TokenService.class);
    private static final String DEFAULT_SECRET = "dev-only-secret-change-me-before-deploying";

    private final String secret;
    private final long ttlSeconds;
    private final Set<String> adminUsernames = new HashSet<>();

    public TokenService(@Value("${game.token-secret:" + DEFAULT_SECRET + "}") String secret,
                        @Value("${game.token-ttl-hours:168}") long ttlHours,
                        @Value("${game.admin-usernames:}") String admins) {
        this.secret = secret;
        this.ttlSeconds = ttlHours * 3600L;
        for (String a : admins.split(",")) {
            if (!a.isBlank()) {
                adminUsernames.add(a.trim().toLowerCase(Locale.ROOT));
            }
        }
    }

    @PostConstruct
    void warn() {
        if (DEFAULT_SECRET.equals(secret)) {
            log.warn("TOKEN_SECRET is not set - using the development secret. Set TOKEN_SECRET in production!");
        }
    }

    public String issue(long userId) {
        long exp = System.currentTimeMillis() / 1000L + ttlSeconds;
        String p = Base64.getUrlEncoder().withoutPadding()
                .encodeToString((userId + ":" + exp).getBytes(StandardCharsets.UTF_8));
        return p + "." + sign(p);
    }

    public Long verify(String token) {
        if (token == null) {
            return null;
        }
        int dot = token.indexOf('.');
        if (dot <= 0 || dot == token.length() - 1) {
            return null;
        }
        String p = token.substring(0, dot);
        String sig = token.substring(dot + 1);
        if (!MessageDigest.isEqual(sign(p).getBytes(StandardCharsets.UTF_8), sig.getBytes(StandardCharsets.UTF_8))) {
            return null;
        }
        try {
            String[] parts = new String(Base64.getUrlDecoder().decode(p), StandardCharsets.UTF_8).split(":");
            if (parts.length != 2 || Long.parseLong(parts[1]) < System.currentTimeMillis() / 1000L) {
                return null;
            }
            return Long.parseLong(parts[0]);
        } catch (RuntimeException e) {
            return null;
        }
    }

    public long requireUserId(String authorizationHeader) {
        String token = authorizationHeader;
        if (token != null && token.regionMatches(true, 0, "Bearer ", 0, 7)) {
            token = token.substring(7).trim();
        }
        Long id = verify(token);
        if (id == null) {
            throw new ApiException(401, "Please log in again");
        }
        return id;
    }

    // ---- one-time password reset links (30 min). The signature covers the current password hash,
    //      so the link stops working as soon as the password changes. ----
    public String issueReset(long userId, String passwordHash) {
        String payload = "r:" + userId + ":" + (System.currentTimeMillis() + 30 * 60 * 1000L);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8))
                + "." + sign(payload + ":" + passwordHash);
    }

    private String[] resetParts(String token) {
        try {
            String payload = new String(Base64.getUrlDecoder().decode(token.split("\\.")[0]), StandardCharsets.UTF_8);
            String[] p = payload.split(":");
            if (p.length != 3 || !p[0].equals("r")) throw new IllegalArgumentException();
            return p;
        } catch (Exception e) {
            throw new ApiException(400, "This reset link is invalid or expired");
        }
    }

    public long userIdFromReset(String token) {
        if (token == null) throw new ApiException(400, "This reset link is invalid or expired");
        return Long.parseLong(resetParts(token)[1]);
    }

    public boolean resetValid(String token, String passwordHash) {
        String[] p = resetParts(token);
        String payload = String.join(":", p);
        String sig = token.split("\\.").length > 1 ? token.split("\\.")[1] : "";
        return Long.parseLong(p[2]) > System.currentTimeMillis()
                && java.security.MessageDigest.isEqual(sig.getBytes(StandardCharsets.UTF_8),
                        sign(payload + ":" + passwordHash).getBytes(StandardCharsets.UTF_8));
    }

    public boolean isAdminUsername(String username) {
        return username != null && adminUsernames.contains(username.toLowerCase(Locale.ROOT));
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
