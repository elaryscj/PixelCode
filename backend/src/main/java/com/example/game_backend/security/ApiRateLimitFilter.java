package com.example.game_backend.security;

import com.example.game_backend.error.ApiException;
import com.example.game_backend.i18n.Lang;
import com.example.game_backend.i18n.ServerText;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * A general ceiling for every /api call, per client address, on top of the stricter per-action limits
 * (login, register, password reset, solution submits). Normal play is ~1-2 requests per second (lobby and
 * game polling), far below these numbers; a script hammering purchases, profile edits or room creation is not.
 * The address comes from X-Forwarded-For behind Render's proxy (server.forward-headers-strategy=framework).
 */
@Component
public class ApiRateLimitFilter extends OncePerRequestFilter {
    private static final long MAX_BODY_BYTES = 1_000_000;
    private final RateLimiter limiter;
    private final int perMinute;
    private final int writesPerMinute;

    public ApiRateLimitFilter(RateLimiter limiter,
                              @Value("${game.limits.api-per-minute:900}") int perMinute,
                              @Value("${game.limits.api-writes-per-minute:150}") int writesPerMinute) {
        this.limiter = limiter;
        this.perMinute = perMinute;
        this.writesPerMinute = writesPerMinute;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/") || path.equals("/api/health") || "OPTIONS".equals(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        // the biggest legitimate body is a skin picture (~700 KB as a data URL); refuse anything far larger
        // before Jackson tries to read it into memory
        long length = req.getContentLengthLong();
        // a chunked body has no length to check up front; browsers always send Content-Length for fetch()
        boolean chunked = length < 0 && req.getHeader("Transfer-Encoding") != null;
        if (length > MAX_BODY_BYTES || chunked) {
            res.setStatus(413);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write(message("Request is too large", req));
            return;
        }
        String ip = req.getRemoteAddr();
        try {
            limiter.hit("api:" + ip, perMinute, 60);
            if (!"GET".equals(req.getMethod())) {
                limiter.hit("api-write:" + ip, writesPerMinute, 60);
            }
        } catch (ApiException e) {
            res.setStatus(429);
            res.setContentType("application/json;charset=UTF-8");
            Object wait = e.getExtra().get("retryAfterSeconds");
            if (wait != null) {
                res.setHeader("Retry-After", String.valueOf(wait));
            }
            res.getWriter().write(message("Too many requests, slow down a little", req));
            return;
        }
        chain.doFilter(req, res);
    }

    /** {"message": ...} in the player's language (this filter runs before Spring's request context exists). */
    private static String message(String english, HttpServletRequest req) {
        String text = ServerText.tr(english, Lang.of(req.getHeader("Accept-Language")));
        return "{\"message\":\"" + text.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}";
    }
}
