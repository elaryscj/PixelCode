package com.example.game_backend.entity;

import jakarta.persistence.*;

import java.time.Instant;

/** An online payment for the teacher subscription (Freedom Pay). Switched to PAID only by the signed callback. */
@Entity
@Table(name = "payments", indexes = @Index(name = "ix_payments_user", columnList = "userId"))
public class Payment {
    public static final String PENDING = "PENDING";
    public static final String PAID = "PAID";
    public static final String FAILED = "FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** our id sent as pg_order_id */
    @Column(nullable = false, unique = true, length = 40)
    private String orderId;
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false, length = 10)
    private String plan;
    @Column(nullable = false)
    private int amount;
    @Column(nullable = false, length = 3)
    private String currency;
    @Column(nullable = false, length = 10)
    private String status = PENDING;
    /** Freedom Pay's pg_payment_id */
    @Column(length = 40)
    private String providerPaymentId;
    @Column(nullable = false)
    private boolean testing;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    private Instant paidAt;

    public Long getId() { return id; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getPlan() { return plan; }
    public void setPlan(String plan) { this.plan = plan; }
    public int getAmount() { return amount; }
    public void setAmount(int amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getProviderPaymentId() { return providerPaymentId; }
    public void setProviderPaymentId(String providerPaymentId) { this.providerPaymentId = providerPaymentId; }
    public boolean isTesting() { return testing; }
    public void setTesting(boolean testing) { this.testing = testing; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getPaidAt() { return paidAt; }
    public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
}
