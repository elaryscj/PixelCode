package com.example.game_backend.repository;

import com.example.game_backend.entity.PlayerBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PlayerBlockRepository extends JpaRepository<PlayerBlock, Long> {
    List<PlayerBlock> findByBlockerIdOrderByCreatedAtDesc(Long blockerId);

    Optional<PlayerBlock> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    long countByBlockerId(Long blockerId);

    @Query("select count(b) > 0 from PlayerBlock b where (b.blockerId = :a and b.blockedId = :b) or (b.blockerId = :b and b.blockedId = :a)")
    boolean existsEitherWay(@Param("a") Long a, @Param("b") Long b);

    @Modifying
    @Query("delete from PlayerBlock b where b.blockerId = :id or b.blockedId = :id")
    void deleteAllFor(@Param("id") Long userId);
}
