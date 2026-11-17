package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/** A friend request (accepted = false) or a friendship. One row per pair, whoever asked first. */
@Entity
@Table(name = "friendships", uniqueConstraints = @UniqueConstraint(columnNames = {"requesterId", "addresseeId"}))
public class Friendship {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long requesterId;
    @Column(nullable = false)
    private Long addresseeId;
    @Column(nullable = false)
    private boolean accepted;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Friendship() {
    }

    public Friendship(Long requesterId, Long addresseeId) {
        this.requesterId = requesterId;
        this.addresseeId = addresseeId;
    }

    public Long getId() { return id; }
    public Long getRequesterId() { return requesterId; }
    public Long getAddresseeId() { return addresseeId; }
    public boolean isAccepted() { return accepted; }
    public void setAccepted(boolean accepted) { this.accepted = accepted; }
    public Instant getCreatedAt() { return createdAt; }

    /** the other person in this pair */
    public Long other(long me) {
        return requesterId == me ? addresseeId : requesterId;
    }
}
