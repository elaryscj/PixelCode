package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "players")
public class Player {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column
    private Long userId;

    @Column
    private String nickname;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean ready;

    @Column
    private Integer ratingBefore;

    @Column
    private Integer ratingDelta;

    @Column
    private String result;

    /** map this player voted for in the lobby (null = no preference) */
    @Column
    private Integer mapVote;

    public Player() {
    }

    public Player(Long userId, String nickname, int rating) {
        this.userId = userId;
        this.nickname = nickname;
        this.ratingBefore = rating;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public boolean isReady() { return ready; }
    public void setReady(boolean ready) { this.ready = ready; }
    public Integer getRatingBefore() { return ratingBefore; }
    public void setRatingBefore(Integer ratingBefore) { this.ratingBefore = ratingBefore; }
    public Integer getRatingDelta() { return ratingDelta; }
    public void setRatingDelta(Integer ratingDelta) { this.ratingDelta = ratingDelta; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public Integer getMapVote() { return mapVote; }
    public void setMapVote(Integer mapVote) { this.mapVote = mapVote; }
}
