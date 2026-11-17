package com.example.game_backend.progress;

import com.example.game_backend.entity.Cosmetic;
import com.example.game_backend.entity.Season;
import com.example.game_backend.entity.SeasonResult;
import com.example.game_backend.entity.User;
import com.example.game_backend.repository.CosmeticRepository;
import com.example.game_backend.repository.SeasonRepository;
import com.example.game_backend.repository.SeasonResultRepository;
import com.example.game_backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Monthly ranked seasons (UTC calendar months). When a month ends, the ten best players who played at least
 * MIN_MATCHES ranked matches get PIXELS and a badge, and every rating moves halfway back to 1500.
 */
@Service
public class SeasonService {
    private static final Logger log = LoggerFactory.getLogger(SeasonService.class);
    public static final int MIN_MATCHES = 3;
    public static final int TOP = 10;
    /** places that also receive the season's exclusive skin */
    public static final int SKIN_PLACES = 3;
    /** PIXELS for places 1, 2, 3; places 4-10 get the last value */
    private static final int[] REWARDS = {1000, 700, 500, 200};

    private final SeasonRepository seasons;
    private final SeasonResultRepository results;
    private final UserRepository users;
    private final CosmeticRepository cosmetics;
    private final TransactionTemplate tx;

    public SeasonService(SeasonRepository seasons, SeasonResultRepository results, UserRepository users,
                         CosmeticRepository cosmetics, PlatformTransactionManager tm) {
        this.seasons = seasons;
        this.results = results;
        this.users = users;
        this.cosmetics = cosmetics;
        this.tx = new TransactionTemplate(tm);
    }

    public static int rewardFor(int place) {
        return REWARDS[Math.min(place, REWARDS.length) - 1];
    }

    static Instant monthStart(YearMonth m) {
        return m.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    /** The running season (created on first use: the current month). */
    public synchronized Season current() {
        return seasons.findFirstByClosedAtIsNullOrderByIdDesc().orElseGet(() -> {
            YearMonth m = YearMonth.now(ZoneOffset.UTC);
            return seasons.save(new Season(monthStart(m), monthStart(m.plusMonths(1))));
        });
    }

    /** The exclusive skin the running season's top 3 will get, if an admin made one. */
    public Cosmetic rewardSkin() {
        return cosmetics.findFirstBySeasonRewardTrueAndAwardedSeasonIsNullOrderByIdDesc().orElse(null);
    }

    public Instant closedAt(long seasonId) {
        return seasons.findById(seasonId).map(Season::getClosedAt).orElse(null);
    }

    public Season lastClosed() {
        return seasons.findFirstByClosedAtIsNotNullOrderByIdDesc().orElse(null);
    }

    public List<SeasonResult> resultsOf(long seasonId) {
        return results.findBySeasonIdOrderByPlaceAsc(seasonId);
    }

    public List<SeasonResult> badgesOf(long userId) {
        return results.findByUserIdOrderBySeasonIdDesc(userId);
    }

    /** Runs every minute: closes the season once its month is over and opens the next one. */
    public synchronized void rollover() {
        Season s = current();
        Instant now = Instant.now();
        if (now.isBefore(s.getEndsAt())) {
            return;
        }
        tx.executeWithoutResult(st -> close(s.getId(), now));
    }

    private void close(long seasonId, Instant now) {
        Season s = seasons.findById(seasonId).orElseThrow();
        if (s.getClosedAt() != null) {
            return;
        }
        List<User> top = users.findTop10ByBotFalseAndSeasonMatchesGreaterThanEqualOrderByRatingDescIdAsc(MIN_MATCHES);
        Cosmetic skin = top.isEmpty() ? null : rewardSkin();
        int place = 1;
        for (User ranked : top) {
            User u = users.findByIdForUpdate(ranked.getId()).orElse(null);
            if (u == null) {
                continue;
            }
            int reward = rewardFor(place);
            u.setPixels(u.getPixels() + reward);
            SeasonResult result = new SeasonResult(s.getId(), u.getId(), u.getUsername(), place, u.getRating(), reward);
            if (skin != null && place <= SKIN_PLACES) {
                java.util.Set<String> owned = new java.util.LinkedHashSet<>(java.util.Arrays.asList(u.getOwnedSkins().split(",")));
                owned.removeIf(String::isBlank);
                owned.add(skin.getSkinId());
                u.setOwnedSkins(String.join(",", owned));
                result.setSkinId(skin.getSkinId());
            }
            users.save(u);
            results.save(result);
            place++;
        }
        if (skin != null) {
            skin.setAwardedSeason(s.getId());
            cosmetics.save(skin);
        }
        int reset = users.softResetRatings();
        s.setClosedAt(now);
        seasons.save(s);
        // the next season is the month we are in now (if the server was off for a while, skipped months are skipped)
        YearMonth m = YearMonth.now(ZoneOffset.UTC);
        Instant start = monthStart(m);
        Instant end = monthStart(m.plusMonths(1));
        seasons.save(new Season(start.isBefore(s.getEndsAt()) ? s.getEndsAt() : start, end));
        log.info("Season {} closed: {} rewarded, {} ratings moved towards 1500", s.getId(), place - 1, reset);
    }
}
