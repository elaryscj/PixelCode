package com.example.game_backend.repository;

import com.example.game_backend.entity.LessonStudent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LessonStudentRepository extends JpaRepository<LessonStudent, Long> {
    Optional<LessonStudent> findByTokenHash(String tokenHash);

    List<LessonStudent> findByLessonIdOrderByIdAsc(Long lessonId);

    long countByLessonId(Long lessonId);

    boolean existsByLessonIdAndNameIgnoreCase(Long lessonId, String name);
}
