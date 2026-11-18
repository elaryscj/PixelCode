package com.example.game_backend.entity;

import jakarta.persistence.*;

import java.time.Instant;

/** One solution a student sent for a door in a lesson; the teacher can read every attempt. */
@Entity
@Table(name = "lesson_submissions", indexes = {
        @Index(name = "ix_lesson_subs_student", columnList = "studentId"),
        @Index(name = "ix_lesson_subs_lesson", columnList = "lessonId")})
public class LessonSubmission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long lessonId;
    @Column(nullable = false)
    private Long studentId;
    @Column(nullable = false)
    private int door;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String code;
    @Column(nullable = false)
    private boolean passed;
    @Column(nullable = false)
    private int passedCount;
    @Column(nullable = false)
    private int total;
    @Column(length = 500)
    private String error;
    @Column(nullable = false)
    private Instant at = Instant.now();

    public LessonSubmission() {
    }

    public LessonSubmission(Long lessonId, Long studentId, int door, String code, boolean passed, int passedCount,
                            int total, String error) {
        this.lessonId = lessonId;
        this.studentId = studentId;
        this.door = door;
        this.code = code;
        this.passed = passed;
        this.passedCount = passedCount;
        this.total = total;
        this.error = error == null ? null : error.length() > 500 ? error.substring(0, 500) : error;
    }

    public Long getId() { return id; }
    public Long getLessonId() { return lessonId; }
    public Long getStudentId() { return studentId; }
    public int getDoor() { return door; }
    public String getCode() { return code; }
    public boolean isPassed() { return passed; }
    public int getPassedCount() { return passedCount; }
    public int getTotal() { return total; }
    public String getError() { return error; }
    public Instant getAt() { return at; }
}
