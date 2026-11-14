package com.example.game_backend.repository;

import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.RoomStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
    Optional<Room> findByCode(String code);

    boolean existsByCode(String code);

    List<Room> findByRoomStatusIn(Collection<RoomStatus> statuses);

    List<Room> findByRoomStatusAndCreatedAtBefore(RoomStatus status, Instant before);

    @Query("select distinct r from Room r join r.players p where p.userId = :userId and r.roomStatus in :statuses")
    List<Room> findActiveForUser(@Param("userId") Long userId, @Param("statuses") Collection<RoomStatus> statuses);

    /** Finished matches of one player, newest first. */
    @Query("select r from Room r where r.roomStatus = com.example.game_backend.entity.RoomStatus.FINISHED"
            + " and exists (select p from Player p where p member of r.players and p.userId = :userId)"
            + " order by r.finishedAt desc nulls last")
    List<Room> findFinishedForUser(@Param("userId") Long userId, Pageable page);
}
