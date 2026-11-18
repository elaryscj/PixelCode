package com.example.game_backend.repository;

import com.example.game_backend.entity.LessonSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LessonSubmissionRepository extends JpaRepository<LessonSubmission, Long> {
    List<LessonSubmission> findByStudentIdOrderByIdAsc(Long studentId);

    List<LessonSubmission> findByLessonId(Long lessonId);
}
