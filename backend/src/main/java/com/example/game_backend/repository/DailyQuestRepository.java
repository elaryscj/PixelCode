package com.example.game_backend.repository;

import com.example.game_backend.entity.DailyQuest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DailyQuestRepository extends JpaRepository<DailyQuest, Long> {
    List<DailyQuest> findByUserIdAndDayOrderByIdAsc(Long userId, LocalDate day);

    void deleteByUserId(Long userId);

    long countByUserIdAndCompletedAtAfter(Long userId, java.time.Instant after);
}
