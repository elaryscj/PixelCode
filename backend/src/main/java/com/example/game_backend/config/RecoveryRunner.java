package com.example.game_backend.config;

import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.RoomStatus;
import com.example.game_backend.game.MatchResultService;
import com.example.game_backend.repository.RoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/** Running matches live in memory; after a restart they are closed without rating changes. */
@Component
public class RecoveryRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(RecoveryRunner.class);

    private final RoomRepository rooms;
    private final MatchResultService results;

    public RecoveryRunner(RoomRepository rooms, MatchResultService results) {
        this.rooms = rooms;
        this.results = results;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (Room r : rooms.findByRoomStatusIn(List.of(RoomStatus.PLAYING))) {
            log.warn("Closing interrupted match {}", r.getCode());
            results.finalizeMatch(r.getCode(), null, "SERVER_RESTART", List.of(), false);
        }
    }
}
