package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** A top-10 finish in a closed season: the player's badge and the PIXELS they received. */
@Entity
@Table(name = "season_results", uniqueConstraints = @UniqueConstraint(columnNames = {"seasonId", "userId"}))
public class SeasonResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long seasonId;
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false)
    private String username;
    @Column(nullable = false)
    private int place;
    @Column(nullable = false)
    private int rating;
    @Column(nullable = false)
    private int reward;
    /** exclusive skin received with this place (top 3), if the season had one */
    @Column
    private String skinId;

    public SeasonResult() {
    }

    public SeasonResult(Long seasonId, Long userId, String username, int place, int rating, int reward) {
        this.seasonId = seasonId;
        this.userId = userId;
        this.username = username;
        this.place = place;
        this.rating = rating;
        this.reward = reward;
    }

    public Long getId() { return id; }
    public Long getSeasonId() { return seasonId; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public int getPlace() { return place; }
    public int getRating() { return rating; }
    public int getReward() { return reward; }
    public String getSkinId() { return skinId; }
    public void setSkinId(String skinId) { this.skinId = skinId; }
}
