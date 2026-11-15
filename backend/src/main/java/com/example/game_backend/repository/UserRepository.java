package com.example.game_backend.repository;

import com.example.game_backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String email);

    /** Older data may hold the same e-mail on several accounts (it used to be possible via profile edit). */
    java.util.List<User> findAllByEmailIgnoreCase(String email);

    java.util.List<User> findByAdminTrue();

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCase(String username);

    List<User> findTop50ByOrderByRatingDescIdAsc();

    /**
     * Reads the row with SELECT ... FOR UPDATE: every change to pixels, rating or owned skins goes through this,
     * so two simultaneous requests (two purchases, a purchase and a match reward) cannot overwrite each other.
     * Must be called inside a transaction.
     */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    long countByRatingGreaterThan(int rating);
}
