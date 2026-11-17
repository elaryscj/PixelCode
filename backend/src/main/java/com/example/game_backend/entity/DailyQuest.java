package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;

/** One of a player's three quests for a UTC day (see game/Quests). The reward is paid when it completes. */
@Entity
@Table(name = "daily_quests", uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "day", "code"}))
public class DailyQuest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false)
    private LocalDate day;
    @Column(nullable = false, length = 32)
    private String code;
    @Column(nullable = false)
    private int target;
    @Column(nullable = false)
    private int progress;
    @Column(nullable = false)
    private int reward;
    @Column
    private Instant completedAt;

    public DailyQuest() {
    }

    public DailyQuest(Long userId, LocalDate day, String code, int target, int reward) {
        this.userId = userId;
        this.day = day;
        this.code = code;
        this.target = target;
        this.reward = reward;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDate getDay() { return day; }
    public String getCode() { return code; }
    public int getTarget() { return target; }
    public int getProgress() { return progress; }
    public void setProgress(int progress) { this.progress = progress; }
    public int getReward() { return reward; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
}
