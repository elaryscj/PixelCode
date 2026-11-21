package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

/** One player's score in one weekend tournament (weekend = the date of its Saturday). */
@Entity
@Table(name = "tournament_entries", uniqueConstraints = @UniqueConstraint(columnNames = {"weekend", "userId"}))
public class TournamentEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private LocalDate weekend;
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false)
    private int points;
    @Column(nullable = false)
    private int played;
    @Column(nullable = false)
    private int wins;
    /** 1, 2, 3 once the prizes are paid (0 = no prize) */
    @Column(nullable = false, columnDefinition = "integer default 0")
    private int place;
    @Column(nullable = false, columnDefinition = "integer default 0")
    private int prize;
    /** when the score last went up: on equal points the earlier one ranks higher */
    @Column
    private java.time.Instant updatedAt;

    public TournamentEntry() {
    }

    public TournamentEntry(LocalDate weekend, Long userId) {
        this.weekend = weekend;
        this.userId = userId;
    }

    public Long getId() { return id; }
    public LocalDate getWeekend() { return weekend; }
    public Long getUserId() { return userId; }
    public int getPoints() { return points; }
    public void setPoints(int points) { this.points = points; }
    public int getPlayed() { return played; }
    public void setPlayed(int played) { this.played = played; }
    public int getWins() { return wins; }
    public void setWins(int wins) { this.wins = wins; }
    public int getPlace() { return place; }
    public void setPlace(int place) { this.place = place; }
    public int getPrize() { return prize; }
    public void setPrize(int prize) { this.prize = prize; }
    public java.time.Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(java.time.Instant updatedAt) { this.updatedAt = updatedAt; }
}
