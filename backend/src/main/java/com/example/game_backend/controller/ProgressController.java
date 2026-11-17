package com.example.game_backend.controller;

import com.example.game_backend.entity.AchievementUnlock;
import com.example.game_backend.entity.DailyQuest;
import com.example.game_backend.entity.Season;
import com.example.game_backend.entity.SeasonResult;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.progress.Achievements;
import com.example.game_backend.progress.ProgressService;
import com.example.game_backend.progress.SeasonService;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Daily quests, achievements and the season, for the PROGRESS screen and the leaderboard header. */
@RestController
public class ProgressController {
    private final ProgressService progress;
    private final SeasonService seasons;
    private final UserRepository users;
    private final TokenService tokens;

    public ProgressController(ProgressService progress, SeasonService seasons, UserRepository users, TokenService tokens) {
        this.progress = progress;
        this.seasons = seasons;
        this.users = users;
        this.tokens = tokens;
    }

    @GetMapping("/api/progress")
    public ResponseEntity<Map<String, Object>> mine(@RequestHeader(value = "Authorization", required = false) String auth) {
        long uid = tokens.requireUserId(auth);
        User u = users.findById(uid).orElseThrow(() -> new ApiException(401, "Please log in again"));
        Map<String, Object> out = new LinkedHashMap<>();

        List<Map<String, Object>> quests = new ArrayList<>();
        for (DailyQuest q : progress.questsToday(uid)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", q.getCode());
            m.put("progress", q.getProgress());
            m.put("target", q.getTarget());
            m.put("reward", q.getReward());
            m.put("completedAt", q.getCompletedAt() == null ? null : q.getCompletedAt().toEpochMilli());
            quests.add(m);
        }
        out.put("quests", quests);
        out.put("questsResetAt", ProgressService.today().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli());

        Map<String, Long> unlocked = new HashMap<>();
        for (AchievementUnlock a : progress.unlocked(uid)) {
            unlocked.put(a.getCode(), a.getUnlockedAt().toEpochMilli());
        }
        List<Map<String, Object>> achievements = new ArrayList<>();
        for (Achievements.Def d : Achievements.ALL) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", d.code());
            m.put("reward", d.reward());
            m.put("target", d.target());
            Long at = unlocked.get(d.code());
            m.put("unlockedAt", at);
            int now = d.counter() == null ? (at != null ? 1 : 0) : d.counter().applyAsInt(u);
            m.put("progress", at != null ? d.target() : Math.min(now, d.target()));
            achievements.add(m);
        }
        out.put("achievements", achievements);

        Map<String, Object> season = seasonView(seasons.current());
        season.put("myMatches", u.getSeasonMatches());
        season.put("myPlace", u.getSeasonMatches() >= SeasonService.MIN_MATCHES
                ? users.countByBotFalseAndSeasonMatchesGreaterThanEqualAndRatingGreaterThan(SeasonService.MIN_MATCHES, u.getRating()) + 1
                : null);
        out.put("season", season);

        List<Map<String, Object>> badges = new ArrayList<>();
        for (SeasonResult r : seasons.badgesOf(uid)) {
            badges.add(resultView(r));
        }
        out.put("badges", badges);
        return ResponseEntity.ok(out);
    }

    /** Public: the running season and the top 10 of the last finished one. */
    @GetMapping("/api/seasons/current")
    public ResponseEntity<Map<String, Object>> current() {
        Map<String, Object> out = seasonView(seasons.current());
        Season last = seasons.lastClosed();
        List<Map<String, Object>> top = new ArrayList<>();
        if (last != null) {
            for (SeasonResult r : seasons.resultsOf(last.getId())) {
                top.add(resultView(r));
            }
        }
        out.put("lastSeason", last == null ? null : last.getId());
        out.put("lastTop", top);
        return ResponseEntity.ok(out);
    }

    private static Map<String, Object> seasonView(Season s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("number", s.getId());
        m.put("startsAt", s.getStartsAt().toEpochMilli());
        m.put("endsAt", s.getEndsAt().toEpochMilli());
        m.put("minMatches", SeasonService.MIN_MATCHES);
        List<Integer> rewards = new ArrayList<>();
        for (int place = 1; place <= SeasonService.TOP; place++) {
            rewards.add(SeasonService.rewardFor(place));
        }
        m.put("rewards", rewards);
        m.put("serverTime", System.currentTimeMillis());
        return m;
    }

    private static Map<String, Object> resultView(SeasonResult r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("season", r.getSeasonId());
        m.put("place", r.getPlace());
        m.put("username", r.getUsername());
        m.put("rating", r.getRating());
        m.put("reward", r.getReward());
        return m;
    }
}
