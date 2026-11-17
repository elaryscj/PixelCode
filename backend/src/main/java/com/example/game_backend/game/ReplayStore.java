package com.example.game_backend.game;

import com.example.game_backend.entity.MatchReplay;
import com.example.game_backend.repository.MatchReplayRepository;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/** Saves recorded matches as JSON and removes them after KEEP. */
@Service
public class ReplayStore {
    public static final Duration KEEP = Duration.ofDays(14);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final MatchReplayRepository replays;

    public ReplayStore(MatchReplayRepository replays) {
        this.replays = replays;
    }

    public void save(String code, Map<String, Object> data) {
        replays.save(new MatchReplay(code, JSON.writeValueAsString(data)));
    }

    public Optional<Map<String, Object>> load(String code) {
        return replays.findById(code).map(r -> JSON.readValue(r.getData(), new TypeReference<Map<String, Object>>() { }));
    }

    public boolean exists(String code) {
        return replays.existsById(code);
    }

    public int cleanup() {
        return replays.deleteOlderThan(Instant.now().minus(KEEP));
    }
}
