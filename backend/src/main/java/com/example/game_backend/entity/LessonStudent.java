package com.example.game_backend.entity;

import jakarta.persistence.*;

import java.time.Instant;

/** A student in a lesson: no account, only a name and a secret token kept in their browser. */
@Entity
@Table(name = "lesson_students", indexes = @Index(name = "ix_lesson_students_lesson", columnList = "lessonId"))
public class LessonStudent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long lessonId;
    @Column(nullable = false, length = 24)
    private String name;
    /** SHA-256 of the student's token (the token itself only lives in their browser) */
    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;
    @Column(nullable = false)
    private Instant joinedAt = Instant.now();
    private Instant lastSeenAt;
    /** doors open so far (they open in order) */
    @Column(nullable = false)
    private int unlocked;
    /** per door: when the student first opened its task / solved it, epoch ms, comma separated ("" = not yet) */
    @Column(nullable = false, length = 200)
    private String openedAt = ",,,";
    @Column(nullable = false, length = 200)
    private String solvedAt = ",,,";
    private Instant finishedAt;
    @Column(nullable = false)
    private int falls;

    public Long getId() { return id; }
    public Long getLessonId() { return lessonId; }
    public void setLessonId(Long lessonId) { this.lessonId = lessonId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public Instant getJoinedAt() { return joinedAt; }
    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }
    public int getUnlocked() { return unlocked; }
    public void setUnlocked(int unlocked) { this.unlocked = unlocked; }
    public String getOpenedAt() { return openedAt; }
    public void setOpenedAt(String openedAt) { this.openedAt = openedAt; }
    public String getSolvedAt() { return solvedAt; }
    public void setSolvedAt(String solvedAt) { this.solvedAt = solvedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant finishedAt) { this.finishedAt = finishedAt; }
    public int getFalls() { return falls; }
    public void setFalls(int falls) { this.falls = falls; }
}
