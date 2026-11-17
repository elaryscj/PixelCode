package com.example.game_backend.controller;

import com.example.game_backend.entity.AchievementUnlock;
import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.SeasonResult;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.ResultViews;
import com.example.game_backend.progress.Achievements;
import com.example.game_backend.progress.ProgressService;
import com.example.game_backend.progress.SeasonService;
import com.example.game_backend.repository.FriendshipRepository;
import com.example.game_backend.repository.RoomRepository;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** A friend's profile: rating, record, achievements, season badges and recent matches (friends and self only). */
@RestController
public class PlayerController {
    private final UserRepository users;
    private final FriendshipRepository friendships;
    private final RoomRepository rooms;
    private final ProgressService progress;
    private final SeasonService seasons;
    private final TokenService tokens;

    public PlayerController(UserRepository users, FriendshipRepository friendships, RoomRepository rooms,
                            ProgressService progress, SeasonService seasons, TokenService tokens) {
        this.users = users;
        this.friendships = friendships;
        this.rooms = rooms;
        this.progress = progress;
        this.seasons = seasons;
        this.tokens = tokens;
    }

    @GetMapping("/api/players/{id}")
    public ResponseEntity<Map<String, Object>> profile(@PathVariable long id,
                                                       @RequestHeader(value = "Authorization", required = false) String auth) {
        long me = tokens.requireUserId(auth);
        if (id != me && friendships.findPair(me, id).filter(f -> f.isAccepted()).isEmpty()) {
            throw new ApiException(403, "Only friends can see this profile");
        }
        User u = users.findById(id).filter(x -> !x.isBot()).orElseThrow(() -> new ApiException(404, "Player not found"));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", u.getId());
        m.put("username", u.getUsername());
        m.put("activeSkin", u.getActiveSkin());
        m.put("rating", u.getRating());
        m.put("wins", u.getWins());
        m.put("losses", u.getLosses());
        m.put("place", users.countByBotFalseAndRatingGreaterThan(u.getRating()) + 1);
        m.put("loginStreak", ProgressService.currentStreak(u, ProgressService.today()));

        Map<String, Long> unlocked = new HashMap<>();
        for (AchievementUnlock a : progress.unlocked(id)) {
            unlocked.put(a.getCode(), a.getUnlockedAt().toEpochMilli());
        }
        List<Map<String, Object>> achievements = new ArrayList<>();
        for (Achievements.Def d : Achievements.ALL) {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("code", d.code());
            a.put("unlockedAt", unlocked.get(d.code()));
            achievements.add(a);
        }
        m.put("achievements", achievements);

        List<Map<String, Object>> badges = new ArrayList<>();
        for (SeasonResult r : seasons.badgesOf(id)) {
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("season", r.getSeasonId());
            b.put("place", r.getPlace());
            b.put("rating", r.getRating());
            badges.add(b);
        }
        m.put("badges", badges);

        List<Map<String, Object>> matches = new ArrayList<>();
        for (Room r : rooms.findFinishedForUser(id, PageRequest.of(0, 10))) {
            Map<String, Object> v = ResultViews.of(r);
            v.put("ranked", r.isRanked());
            v.put("finishedAt", r.getFinishedAt() == null ? null : r.getFinishedAt().toEpochMilli());
            matches.add(v);
        }
        m.put("matches", matches);
        return ResponseEntity.ok(m);
    }
}
