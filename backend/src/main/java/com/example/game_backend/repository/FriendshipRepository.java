package com.example.game_backend.repository;

import com.example.game_backend.entity.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    @Query("select f from Friendship f where f.requesterId = :id or f.addresseeId = :id order by f.createdAt asc")
    List<Friendship> findAllFor(@Param("id") Long userId);

    @Query("select f from Friendship f where (f.requesterId = :a and f.addresseeId = :b) or (f.requesterId = :b and f.addresseeId = :a)")
    Optional<Friendship> findPair(@Param("a") Long a, @Param("b") Long b);

    long countByAddresseeIdAndAcceptedFalse(Long userId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("delete from Friendship f where f.requesterId = :id or f.addresseeId = :id")
    void deleteAllFor(@Param("id") Long userId);
}
