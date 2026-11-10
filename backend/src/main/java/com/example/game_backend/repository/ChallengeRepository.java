package com.example.game_backend.repository;

import com.example.game_backend.entity.Challenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {
    List<Challenge> findByPublishedTrueAndDifficulty(String difficulty);

    List<Challenge> findAllByOrderByIdDesc();
}
