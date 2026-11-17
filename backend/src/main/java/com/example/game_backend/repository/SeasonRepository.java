package com.example.game_backend.repository;

import com.example.game_backend.entity.Season;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SeasonRepository extends JpaRepository<Season, Long> {
    Optional<Season> findFirstByClosedAtIsNullOrderByIdDesc();

    Optional<Season> findFirstByClosedAtIsNotNullOrderByIdDesc();
}
