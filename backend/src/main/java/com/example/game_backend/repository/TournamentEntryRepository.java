package com.example.game_backend.repository;

import com.example.game_backend.entity.TournamentEntry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TournamentEntryRepository extends JpaRepository<TournamentEntry, Long> {
    Optional<TournamentEntry> findByWeekendAndUserId(LocalDate weekend, Long userId);

    @Query("select e from TournamentEntry e where e.weekend = :w order by e.points desc, e.wins desc, e.updatedAt asc")
    List<TournamentEntry> standings(@Param("w") LocalDate weekend, Pageable page);

    @Query("select count(e) from TournamentEntry e where e.weekend = :w and (e.points > :p or (e.points = :p and e.wins > :wins))")
    long countAhead(@Param("w") LocalDate weekend, @Param("p") int points, @Param("wins") int wins);

    long countByWeekend(LocalDate weekend);

    @Query("select e from TournamentEntry e where e.weekend = :w and e.place > 0 order by e.place asc")
    List<TournamentEntry> winners(@Param("w") LocalDate weekend);

    @Modifying
    @Query("delete from TournamentEntry e where e.userId = :id")
    void deleteAllFor(@Param("id") Long userId);
}
