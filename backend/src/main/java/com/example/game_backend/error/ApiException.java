package com.example.game_backend.error;

import java.util.LinkedHashMap;
import java.util.Map;

public class ApiException extends RuntimeException {
    private final int status;
    private final Map<String, Object> extra = new LinkedHashMap<>();

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public ApiException with(String key, Object value) {
        extra.put(key, value);
        return this;
    }

    public int getStatus() { return status; }
    public Map<String, Object> getExtra() { return extra; }
}
