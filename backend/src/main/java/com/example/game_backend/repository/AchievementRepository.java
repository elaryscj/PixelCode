package com.example.game_backend.repository;

import com.example.game_backend.entity.AchievementUnlock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AchievementRepository extends JpaRepository<AchievementUnlock, Long> {
    List<AchievementUnlock> findByUserId(Long userId);

    boolean existsByUserIdAndCode(Long userId, String code);

    void deleteByUserId(Long userId);
}
