package com.example.game_backend.error;

import com.example.game_backend.i18n.ServerText;
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
        body.put("message", ServerText.tr(e.getMessage()));
        body.putAll(e.getExtra());
        return ResponseEntity.status(e.getStatus()).body(body);
    }

    /** Database down, slow or a lock wait timed out: a temporary problem, so tell the client to retry. */
    @ExceptionHandler({org.springframework.dao.DataAccessException.class,
            org.springframework.transaction.TransactionException.class})
    public ResponseEntity<Map<String, Object>> handleDatabase(Exception e) {
        log.error("Database error", e);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", ServerText.tr("The server is busy right now, please try again in a moment"));
        return ResponseEntity.status(503).header("Retry-After", "2").body(body);
    }

    /** Malformed requests (bad JSON, a letter where a number is expected): the client's mistake, not a crash. */
    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", ServerText.tr("Invalid request"));
        return ResponseEntity.status(400).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleOther(Exception e) {
        // unknown address, wrong HTTP method, missing parameter...: answer with Spring's own 4xx status, no stack trace
        if (e instanceof org.springframework.web.ErrorResponse er && er.getStatusCode().is4xxClientError()) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("message", ServerText.tr(er.getStatusCode().value() == 404 ? "Not found" : "Invalid request"));
            return ResponseEntity.status(er.getStatusCode()).body(body);
        }
        log.error("Unhandled error", e);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", ServerText.tr("Internal server error"));
        return ResponseEntity.status(500).body(body);
    }
}
