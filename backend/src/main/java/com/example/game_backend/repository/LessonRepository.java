package com.example.game_backend.repository;

import com.example.game_backend.entity.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LessonRepository extends JpaRepository<Lesson, Long> {
    Optional<Lesson> findByCode(String code);

    boolean existsByCode(String code);

    List<Lesson> findTop50ByTeacherIdOrderByCreatedAtDesc(Long teacherId);
}
