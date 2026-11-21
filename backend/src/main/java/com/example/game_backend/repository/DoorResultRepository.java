package com.example.game_backend.repository;

import com.example.game_backend.entity.DoorResult;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface DoorResultRepository extends JpaRepository<DoorResult, Long> {
    boolean existsByChallengeIdAndUserId(Long challengeId, Long userId);

    List<DoorResult> findByRoomCodeAndUserIdOrderByIdAsc(String roomCode, Long userId);

    List<DoorResult> findByChallengeIdAndUserIdOrderByIdDesc(Long challengeId, Long userId);

    @Query("select d from DoorResult d where d.challengeId = :cid and d.outcome = 'SOLVED' order by d.sourceChars asc, d.seconds asc")
    List<DoorResult> shortest(@Param("cid") Long challengeId, Pageable page);

    @Query("select d from DoorResult d where d.challengeId = :cid and d.outcome = 'SOLVED' order by d.seconds asc, d.attempts asc")
    List<DoorResult> fastest(@Param("cid") Long challengeId, Pageable page);

    /** challengeId, outcome, count, avg attempts, avg seconds (for the admin STATS tab) */
    @Query("select d.challengeId, d.outcome, count(d), avg(d.attempts), avg(d.seconds) from DoorResult d"
            + " where d.createdAt >= :since group by d.challengeId, d.outcome")
    List<Object[]> summary(@Param("since") Instant since);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("delete from DoorResult d where d.userId = :id")
    void deleteAllFor(@Param("id") Long userId);
}
