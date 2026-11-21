package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/** A weekend whose prizes were handed out (so a restart never pays twice). */
@Entity
@Table(name = "tournament_weekends")
public class TournamentWeekend {
    @Id
    private LocalDate weekend;
    @Column(nullable = false)
    private Instant paidAt = Instant.now();

    public TournamentWeekend() {
    }

    public TournamentWeekend(LocalDate weekend) {
        this.weekend = weekend;
    }

    public LocalDate getWeekend() { return weekend; }
    public Instant getPaidAt() { return paidAt; }
}
