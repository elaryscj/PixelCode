package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * How one player did at one door of a match: kept for good (unlike replays) to balance the challenges
 * (admin STATS) and to show the best solutions of a challenge to players who met it.
 */
@Entity
@Table(name = "door_results", indexes = {
        @Index(name = "idx_door_results_challenge", columnList = "challengeId"),
        @Index(name = "idx_door_results_user", columnList = "userId"),
        @Index(name = "idx_door_results_room", columnList = "roomCode")})
public class DoorResult {
    /** solved with code / opened by the 4-minute timer / opened but the match ended first */
    public static final String SOLVED = "SOLVED", TIMEOUT = "TIMEOUT", UNSOLVED = "UNSOLVED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long challengeId;
    @Column(nullable = false)
    private Long userId;
    @Column(length = 16)
    private String roomCode;
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean botMatch;
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean ranked;
    @Column(nullable = false)
    private int rating;
    @Column(nullable = false, length = 10)
    private String outcome;
    /** submissions sent (wrong ones included) */
    @Column(nullable = false)
    private int attempts;
    /** from opening the door to its unlocking (or to the end of the match) */
    @Column(nullable = false)
    private int seconds;
    /** the accepted code (SOLVED only) */
    @Column(columnDefinition = "TEXT")
    private String source;
    /** length without whitespace: "shortest solution" does not reward deleting line breaks */
    @Column
    private Integer sourceChars;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public DoorResult() {
    }

    public DoorResult(long challengeId, long userId, String roomCode, boolean botMatch, boolean ranked, int rating,
                      String outcome, int attempts, int seconds, String source) {
        this.challengeId = challengeId;
        this.userId = userId;
        this.roomCode = roomCode;
        this.botMatch = botMatch;
        this.ranked = ranked;
        this.rating = rating;
        this.outcome = outcome;
        this.attempts = attempts;
        this.seconds = seconds;
        this.source = source;
        this.sourceChars = source == null ? null : source.replaceAll("\\s+", "").length();
    }

    public Long getId() { return id; }
    public Long getChallengeId() { return challengeId; }
    public Long getUserId() { return userId; }
    public String getRoomCode() { return roomCode; }
    public boolean isBotMatch() { return botMatch; }
    public boolean isRanked() { return ranked; }
    public int getRating() { return rating; }
    public String getOutcome() { return outcome; }
    public int getAttempts() { return attempts; }
    public int getSeconds() { return seconds; }
    public String getSource() { return source; }
    public Integer getSourceChars() { return sourceChars; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
