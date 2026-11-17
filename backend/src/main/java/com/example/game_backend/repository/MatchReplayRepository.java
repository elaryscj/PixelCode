package com.example.game_backend.repository;

import com.example.game_backend.entity.MatchReplay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

public interface MatchReplayRepository extends JpaRepository<MatchReplay, String> {
    @Modifying
    @Transactional
    @Query("delete from MatchReplay r where r.createdAt < :before")
    int deleteOlderThan(@Param("before") Instant before);
}
