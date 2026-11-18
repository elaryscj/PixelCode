package com.example.game_backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {
    private final JdbcTemplate jdbc;
    /** where this server runs (SERVER_REGION, e.g. "oregon", "frankfurt"); "" = not told. Shown in the game. */
    private final String region;

    public HealthController(javax.sql.DataSource dataSource,
                            @org.springframework.beans.factory.annotation.Value("${game.server-region:}") String region) {
        // a server started on a laptop is "local" unless told otherwise; on the hosting the operator sets it
        this.region = !region.isBlank() ? region.trim().toLowerCase(java.util.Locale.ROOT)
                : System.getenv("RENDER") == null ? "local" : "";
        // own template with a short timeout, so the app-wide JdbcTemplate settings stay untouched
        this.jdbc = new JdbcTemplate(dataSource);
        this.jdbc.setQueryTimeout(3);
    }

    /** Light: the in-game ping meter calls this every few seconds, so it must not touch the database. */
    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "region", region));
    }

    /** For the hosting health check / monitoring: also proves the database answers. 503 when it does not. */
    @GetMapping("/api/health/deep")
    public ResponseEntity<Map<String, Object>> deep() {
        Map<String, Object> m = new LinkedHashMap<>();
        Runtime rt = Runtime.getRuntime();
        m.put("uptimeSeconds", ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        m.put("heapUsedMb", (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024));
        m.put("heapMaxMb", rt.maxMemory() / (1024 * 1024));
        try {
            jdbc.queryForObject("select 1", Integer.class);
            m.put("database", "ok");
            m.put("status", "ok");
            return ResponseEntity.ok(m);
        } catch (RuntimeException e) {
            m.put("database", "unreachable");
            m.put("status", "degraded");
            return ResponseEntity.status(503).body(m);
        }
    }
}
