package com.example.game_backend.payment;

import com.example.game_backend.entity.Payment;
import com.example.game_backend.entity.User;
import com.example.game_backend.repository.PaymentRepository;
import com.example.game_backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** Real PostgreSQL ("pixelcode_test"): Freedom Pay notifications switch the teacher subscription on, once. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/pixelcode_test",
        // "update", not "create-drop": this test has its own Spring context (other settings), and dropping the
        // shared test schema under the other contexts restarts user ids that their in-memory state remembers
        "spring.jpa.hibernate.ddl-auto=update",
        "game.freedom.merchant-id=12345",
        "game.freedom.secret-key=test_secret_key",
        "game.limits.api-writes-per-minute=10000",
        "game.limits.api-per-minute=10000",
})
class PaymentFlowTest {
    private static final String PATH = "/api/payments/freedom/result";
    @Autowired PaymentService service;
    @Autowired PaymentRepository payments;
    @Autowired UserRepository users;

    /** The example from docs.freedompay.kz (Merchant API, Signature). */
    @Test
    void signatureMatchesTheDocumentation() {
        Map<String, String> p = new HashMap<>();
        p.put("pg_merchant_id", "12345");
        p.put("pg_order_id", "order_1001");
        p.put("pg_amount", "100");
        p.put("pg_currency", "KZT");
        p.put("pg_description", "Order #1001");
        p.put("pg_salt", "a1b2c3d4");
        assertEquals("b9ad75871668ca040f80f5f6b530e6ed", FreedomPaySignature.sign("init_payment.php", p, "test_secret_key"));
        assertEquals("init_payment.php", FreedomPaySignature.scriptName("https://api.freedompay.kz/init_payment.php"));
        assertEquals("result", FreedomPaySignature.scriptName(PATH));
    }

    private Map<String, String> notification(Payment p, String result, String amount, String key) {
        Map<String, String> m = new HashMap<>();
        m.put("pg_order_id", p.getOrderId());
        m.put("pg_payment_id", "1022123804618");
        m.put("pg_amount", amount);
        m.put("pg_currency", "KZT");
        m.put("pg_result", result);
        m.put("pg_can_reject", "1");
        m.put("pg_payment_method", "bankcard");
        m.put("pg_salt", "bR5xQ2mL8nT4vW1z");
        m.put("pg_sig", FreedomPaySignature.sign("result", m, key));
        return m;
    }

    private Payment pending(User u, String plan, int amount) {
        Payment p = new Payment();
        p.setOrderId("pc-test-" + UUID.randomUUID().toString().substring(0, 12));
        p.setUserId(u.getId());
        p.setPlan(plan);
        p.setAmount(amount);
        p.setCurrency("KZT");
        return payments.save(p);
    }

    @Test
    void paidNotificationSwitchesTheSubscriptionOnOnce() {
        assertTrue(service.enabled());
        User u = users.save(new User("pay" + UUID.randomUUID().toString().substring(0, 8), "x"));
        Payment p = pending(u, "YEAR", 39990);

        // a forged notification (wrong key) does nothing
        assertTrue(service.onResult(PATH, notification(p, "1", "39990", "wrong_key")).contains("error"));
        assertFalse(users.findById(u.getId()).orElseThrow().hasTeacherAccess());
        // the wrong amount is refused
        assertTrue(service.onResult(PATH, notification(p, "1", "100", "test_secret_key")).contains("rejected"));
        assertFalse(users.findById(u.getId()).orElseThrow().hasTeacherAccess());

        // the real one: a school year of teacher mode at once
        assertTrue(service.onResult(PATH, notification(p, "1", "39990", "test_secret_key")).contains("<pg_status>ok"));
        User after = users.findById(u.getId()).orElseThrow();
        assertTrue(after.hasTeacherAccess());
        java.time.Instant until = after.getTeacherUntil();
        assertTrue(until.isAfter(java.time.Instant.now().plus(java.time.Duration.ofDays(364))));
        assertEquals("PAID", service.orderStatus(u.getId(), p.getOrderId()).get("status"));

        // Freedom Pay repeats the notification: applied only once
        assertTrue(service.onResult(PATH, notification(p, "1", "39990", "test_secret_key")).contains("<pg_status>ok"));
        assertEquals(until, users.findById(u.getId()).orElseThrow().getTeacherUntil());

        // a failed payment of another order changes nothing
        Payment q = pending(u, "MONTH", 4990);
        service.onResult(PATH, notification(q, "0", "4990", "test_secret_key"));
        assertEquals("FAILED", service.orderStatus(u.getId(), q.getOrderId()).get("status"));
        assertEquals(until, users.findById(u.getId()).orElseThrow().getTeacherUntil());
    }
}
