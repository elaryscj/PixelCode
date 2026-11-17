package com.example.game_backend.config;

import com.example.game_backend.game.GameService;
import com.example.game_backend.progress.SeasonService;
import com.example.game_backend.service.MatchmakingService;
import com.example.game_backend.service.RoomService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** One-second server heartbeat: door timers, absence, no-shows, matchmaking. */
@Component
public class GameScheduler {
    private static final Logger log = LoggerFactory.getLogger(GameScheduler.class);

    private final GameService games;
    private final RoomService rooms;
    private final MatchmakingService matchmaking;
    private final SeasonService seasons;

    public GameScheduler(GameService games, RoomService rooms, MatchmakingService matchmaking, SeasonService seasons) {
        this.games = games;
        this.rooms = rooms;
        this.matchmaking = matchmaking;
        this.seasons = seasons;
    }

    @Scheduled(fixedDelay = 1000)
    public void tick() {
        try { games.tick(); } catch (RuntimeException e) { log.error("games.tick failed", e); }
        try { rooms.sweepAssignments(); } catch (RuntimeException e) { log.error("sweepAssignments failed", e); }
        try { matchmaking.pair(); } catch (RuntimeException e) { log.error("matchmaking.pair failed", e); }
    }

    /** PIXEL_BOT moves four times a second, so its sprite glides instead of jumping once per second. */
    @Scheduled(fixedDelay = 250)
    public void botTick() {
        try { games.botTick(); } catch (RuntimeException e) { log.error("games.botTick failed", e); }
    }

    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void cleanup() {
        try { rooms.cleanupStale(); } catch (RuntimeException e) { log.error("cleanupStale failed", e); }
        try { seasons.rollover(); } catch (RuntimeException e) { log.error("season rollover failed", e); }
    }
}
