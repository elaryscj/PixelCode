package com.example.game_backend.repository;

import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.RoomStatus;
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
}
