package com.example.game_backend.controller;

import com.example.game_backend.i18n.Lang;
import com.example.game_backend.payment.PaymentService;
import com.example.game_backend.security.AdminAccess;
import com.example.game_backend.security.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Online payment of the teacher subscription (Freedom Pay). */
@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    private final PaymentService payments;
    private final TokenService tokens;
    private final AdminAccess admins;

    public PaymentController(PaymentService payments, TokenService tokens, AdminAccess admins) {
        this.payments = payments;
        this.tokens = tokens;
        this.admins = admins;
    }

    public record CheckoutBody(String plan) {
    }

    /** Starts a payment; the answer's redirectUrl is Freedom Pay's payment page. */
    @PostMapping("/checkout")
    public Map<String, Object> checkout(@RequestBody CheckoutBody body,
                                        @RequestHeader(value = "Authorization", required = false) String auth) {
        return payments.checkout(tokens.requireUserId(auth), body == null ? null : body.plan(), Lang.current());
    }

    @GetMapping("/{orderId}")
    public Map<String, Object> status(@PathVariable String orderId,
                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        return payments.orderStatus(tokens.requireUserId(auth), orderId);
    }

    /** Freedom Pay calls this (form-encoded, signed) when a payment is final. */
    @PostMapping(value = "/freedom/result", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> freedomResult(@RequestParam Map<String, String> params, HttpServletRequest req) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_XML).body(payments.onResult(req.getRequestURI(), params));
    }

    @GetMapping("/admin/recent")
    public List<Map<String, Object>> recent(@RequestHeader(value = "Authorization", required = false) String auth) {
        admins.require(auth);
        return payments.recent();
    }
}
