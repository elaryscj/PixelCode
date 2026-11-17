package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/** One achievement a player has earned (see game/Achievements). */
@Entity
@Table(name = "user_achievements", uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "code"}))
public class AchievementUnlock {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false, length = 32)
    private String code;
    @Column(nullable = false)
    private Instant unlockedAt;

    public AchievementUnlock() {
    }

    public AchievementUnlock(Long userId, String code, Instant unlockedAt) {
        this.userId = userId;
        this.code = code;
        this.unlockedAt = unlockedAt;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getCode() { return code; }
    public Instant getUnlockedAt() { return unlockedAt; }
}
