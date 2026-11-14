package com.example.game_backend.security;

import com.example.game_backend.error.ApiException;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Small in-memory sliding-window limiter for login / register / password reset.
 * One backend instance is enough for this project; with several instances it would need a shared store.
 */
@Component
public class RateLimiter {
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    /** Records one attempt for `key`; throws 429 when more than `max` happened within `windowSeconds`. */
    public void hit(String key, int max, long windowSeconds) {
        long now = System.currentTimeMillis();
        long from = now - windowSeconds * 1000L;
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst() < from) {
                q.pollFirst();
            }
            if (q.size() >= max) {
                long waitSec = Math.max(1, (q.peekFirst() + windowSeconds * 1000L - now + 999) / 1000);
                throw new ApiException(429, "Too many attempts. Try again in " + (waitSec >= 60 ? (waitSec + 59) / 60 + " min" : waitSec + " s"))
                        .with("retryAfterSeconds", waitSec);
            }
            q.addLast(now);
        }
    }

    /** Forget the attempts of `key` (e.g. after a successful login). */
    public void reset(String key) {
        hits.remove(key);
    }

    /** Drops idle keys so the map does not grow forever. */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 600_000)
    public void cleanup() {
        long old = System.currentTimeMillis() - 24 * 3600_000L;
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().isEmpty() || e.getValue().peekLast() < old;
            }
        });
    }
}
