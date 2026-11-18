package com.example.game_backend.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * A class lesson (teacher mode): students join with a code and only a name, then all run the same map with
 * the same four doors (challenges chosen by the teacher), each on their own. The teacher watches a live table.
 */
@Entity
@Table(name = "lessons", indexes = @Index(name = "ix_lessons_teacher", columnList = "teacherId"))
public class Lesson {
    public static final String LOBBY = "LOBBY";
    public static final String RUNNING = "RUNNING";
    public static final String ENDED = "ENDED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 8)
    private String code;
    @Column(nullable = false)
    private Long teacherId;
    @Column(nullable = false, length = 60)
    private String title;
    @Column(nullable = false)
    private int mapId;
    /** the four challenge ids, door 1..4, comma separated */
    @Column(nullable = false, length = 200)
    private String challengeIds;
    @Column(nullable = false)
    private int durationMinutes;
    @Column(nullable = false, length = 10)
    private String status = LOBBY;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    private Instant startedAt;
    private Instant endsAt;

    public Long getId() { return id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public Long getTeacherId() { return teacherId; }
    public void setTeacherId(Long teacherId) { this.teacherId = teacherId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public int getMapId() { return mapId; }
    public void setMapId(int mapId) { this.mapId = mapId; }
    public String getChallengeIds() { return challengeIds; }
    public void setChallengeIds(String challengeIds) { this.challengeIds = challengeIds; }
    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getEndsAt() { return endsAt; }
    public void setEndsAt(Instant endsAt) { this.endsAt = endsAt; }
}
