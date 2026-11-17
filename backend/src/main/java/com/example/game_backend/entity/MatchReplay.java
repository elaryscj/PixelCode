package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** A finished match recorded for watching again (positions, doors, solutions). Kept for a limited time. */
@Entity
@Table(name = "match_replays")
public class MatchReplay {
    @Id
    @Column(length = 16)
    private String code;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    @Column(nullable = false, columnDefinition = "TEXT")
    private String data;

    public MatchReplay() {
    }

    public MatchReplay(String code, String data) {
        this.code = code;
        this.data = data;
    }

    public String getCode() { return code; }
    public Instant getCreatedAt() { return createdAt; }
    public String getData() { return data; }
}
