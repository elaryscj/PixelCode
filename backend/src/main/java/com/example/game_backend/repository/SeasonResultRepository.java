package com.example.game_backend.repository;

import com.example.game_backend.entity.SeasonResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeasonResultRepository extends JpaRepository<SeasonResult, Long> {
    List<SeasonResult> findByUserIdOrderBySeasonIdDesc(Long userId);

    List<SeasonResult> findBySeasonIdOrderByPlaceAsc(Long seasonId);

    void deleteByUserId(Long userId);
}
