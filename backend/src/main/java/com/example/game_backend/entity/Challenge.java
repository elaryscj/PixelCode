package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "challenges")
public class Challenge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String title;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;
    @Column(columnDefinition = "TEXT")
    private String inputDescription;
    @Column(columnDefinition = "TEXT")
    private String outputDescription;
    @Column(nullable = false)
    private String functionName;
    @Column(columnDefinition = "TEXT")
    private String starterCode;
    @Column(columnDefinition = "TEXT")
    private String examples;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String testsJson;
    @Column(nullable = false)
    private String difficulty = "EASY";
    @Column(nullable = false)
    private boolean published = true;
    @Column
    private Instant createdAt = Instant.now();

    public Challenge() {
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
    public String getInputDescription() { return inputDescription; }
    public void setInputDescription(String v) { this.inputDescription = v; }
    public String getOutputDescription() { return outputDescription; }
    public void setOutputDescription(String v) { this.outputDescription = v; }
    public String getFunctionName() { return functionName; }
    public void setFunctionName(String v) { this.functionName = v; }
    public String getStarterCode() { return starterCode; }
    public void setStarterCode(String v) { this.starterCode = v; }
    public String getExamples() { return examples; }
    public void setExamples(String v) { this.examples = v; }
    public String getTestsJson() { return testsJson; }
    public void setTestsJson(String v) { this.testsJson = v; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String v) { this.difficulty = v; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean v) { this.published = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant v) { this.createdAt = v; }
}
