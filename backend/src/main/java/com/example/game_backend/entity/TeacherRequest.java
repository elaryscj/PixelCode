package com.example.game_backend.entity;

import jakarta.persistence.*;

import java.time.Instant;

/** A teacher asks for a paid subscription; the admin sends an invoice and switches the access on in /admin. */
@Entity
@Table(name = "teacher_requests")
public class TeacherRequest {
    public static final String NEW = "NEW";
    public static final String DONE = "DONE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false, length = 10)
    private String plan; // MONTH | YEAR
    @Column(nullable = false, length = 120)
    private String school;
    @Column(nullable = false, length = 120)
    private String contact;
    @Column(length = 500)
    private String note;
    @Column(nullable = false, length = 10)
    private String status = NEW;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getPlan() { return plan; }
    public void setPlan(String plan) { this.plan = plan; }
    public String getSchool() { return school; }
    public void setSchool(String school) { this.school = school; }
    public String getContact() { return contact; }
    public void setContact(String contact) { this.contact = contact; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}
