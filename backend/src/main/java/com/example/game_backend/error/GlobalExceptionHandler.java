package com.example.game_backend.error;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", e.getMessage());
        body.putAll(e.getExtra());
        return ResponseEntity.status(e.getStatus()).body(body);
    }

    /** Database down, slow or a lock wait timed out: a temporary problem, so tell the client to retry. */
    @ExceptionHandler({org.springframework.dao.DataAccessException.class,
            org.springframework.transaction.TransactionException.class})
    public ResponseEntity<Map<String, Object>> handleDatabase(Exception e) {
        log.error("Database error", e);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "The server is busy right now, please try again in a moment");
        return ResponseEntity.status(503).header("Retry-After", "2").body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleOther(Exception e) {
        log.error("Unhandled error", e);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Internal server error");
        return ResponseEntity.status(500).body(body);
    }
}
