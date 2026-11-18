package com.example.game_backend.repository;

import com.example.game_backend.entity.Challenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {
    List<Challenge> findByPublishedTrueAndDifficulty(String difficulty);

    List<Challenge> findAllByOrderByIdDesc();
    boolean existsByTitle(String title);
    List<Challenge> findByPublishedTrue();

    /** a teacher's own tasks (teacher mode) */
    List<Challenge> findByOwnerIdOrderByIdDesc(Long ownerId);

    long countByOwnerId(Long ownerId);
}
