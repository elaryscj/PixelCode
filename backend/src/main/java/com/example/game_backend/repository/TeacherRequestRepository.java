package com.example.game_backend.repository;

import com.example.game_backend.entity.TeacherRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeacherRequestRepository extends JpaRepository<TeacherRequest, Long> {
    List<TeacherRequest> findTop100ByOrderByIdDesc();

    boolean existsByUserIdAndStatus(Long userId, String status);
}
