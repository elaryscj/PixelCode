package com.example.game_backend.game;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class EvalResult {
    public final boolean passed;
    public final int passedCount;
    public final int total;
    public final String errorMessage;
    public final List<Map<String, Object>> details;

    public EvalResult(boolean passed, int passedCount, int total, String errorMessage, List<Map<String, Object>> details) {
        this.passed = passed;
        this.passedCount = passedCount;
        this.total = total;
        this.errorMessage = errorMessage;
        this.details = details;
    }

    public static EvalResult error(String message) {
        return new EvalResult(false, 0, 0, message, new ArrayList<>());
    }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("passed", passed);
        m.put("passedCount", passedCount);
        m.put("total", total);
        m.put("errorMessage", errorMessage);
        m.put("details", details);
        return m;
    }
}
