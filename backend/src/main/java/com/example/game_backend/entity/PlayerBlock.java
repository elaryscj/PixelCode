package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/** blocker no longer meets blocked: no friend requests, duels, joining rooms, watching or ranked pairing (both ways). */
@Entity
@Table(name = "player_blocks", uniqueConstraints = @UniqueConstraint(columnNames = {"blockerId", "blockedId"}))
public class PlayerBlock {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long blockerId;
    @Column(nullable = false)
    private Long blockedId;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public PlayerBlock() {
    }

    public PlayerBlock(Long blockerId, Long blockedId) {
        this.blockerId = blockerId;
        this.blockedId = blockedId;
    }

    public Long getId() { return id; }
    public Long getBlockerId() { return blockerId; }
    public Long getBlockedId() { return blockedId; }
    public Instant getCreatedAt() { return createdAt; }
}
