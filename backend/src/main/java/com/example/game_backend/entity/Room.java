package com.example.game_backend.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "rooms")
public class Room {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomStatus roomStatus;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "room_id")
    private List<Player> players = new ArrayList<>();

    @Column
    private Instant createdAt;
    @Column
    private Instant assignedAt;
    @Column
    private Instant startedAt;
    @Column
    private Instant finishedAt;
    @Column
    private Long winnerUserId;
    @Column
    private String resultReason;
    @Column
    private Long durationSeconds;

    /** arena map chosen when the match starts (from the players' votes) */
    @Column
    private Integer mapId;

    /** private room opened from this one's result screen with "Rematch" */
    @Column
    private String rematchCode;

    /** true for rooms created by the ranked queue (they start automatically, no manual READY) */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean ranked = false;

    public Room() {
    }

    public Room(String code, RoomStatus roomStatus) {
        this.code = code;
        this.roomStatus = roomStatus;
        this.createdAt = Instant.now();
    }

    public String getRematchCode() { return rematchCode; }
    public void setRematchCode(String rematchCode) { this.rematchCode = rematchCode; }
    public Integer getMapId() { return mapId; }
    public void setMapId(Integer mapId) { this.mapId = mapId; }
    public boolean isRanked() { return ranked; }
    public void setRanked(boolean ranked) { this.ranked = ranked; }
    public Long getId() { return id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public RoomStatus getRoomStatus() { return roomStatus; }
    public void setRoomStatus(RoomStatus roomStatus) { this.roomStatus = roomStatus; }
    public List<Player> getPlayers() { return players; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant finishedAt) { this.finishedAt = finishedAt; }
    public Long getWinnerUserId() { return winnerUserId; }
    public void setWinnerUserId(Long winnerUserId) { this.winnerUserId = winnerUserId; }
    public String getResultReason() { return resultReason; }
    public void setResultReason(String resultReason) { this.resultReason = resultReason; }
    public Long getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Long durationSeconds) { this.durationSeconds = durationSeconds; }

    public Player findPlayer(Long userId) {
        for (Player p : players) {
            if (p.getUserId() != null && p.getUserId().equals(userId)) {
                return p;
            }
        }
        return null;
    }
}
