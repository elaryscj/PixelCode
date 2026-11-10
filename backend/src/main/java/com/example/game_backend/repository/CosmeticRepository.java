package com.example.game_backend.repository;

import com.example.game_backend.entity.Cosmetic;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CosmeticRepository extends JpaRepository<Cosmetic, Long> {
    List<Cosmetic> findByPublishedTrueOrderByIdAsc();

    List<Cosmetic> findAllByOrderByIdDesc();
}
