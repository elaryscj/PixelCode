package com.example.game_backend.repository;

import com.example.game_backend.entity.TournamentWeekend;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface TournamentWeekendRepository extends JpaRepository<TournamentWeekend, LocalDate> {
}
