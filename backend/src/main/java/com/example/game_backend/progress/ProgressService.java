package com.example.game_backend.progress;

import com.example.game_backend.entity.AchievementUnlock;
import com.example.game_backend.entity.DailyQuest;
import com.example.game_backend.entity.Player;
import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.User;
import com.example.game_backend.repository.AchievementRepository;
import com.example.game_backend.repository.DailyQuestRepository;
import com.example.game_backend.repository.SeasonResultRepository;
import com.example.game_backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Achievements and daily quests. Events come from the game (a door solved, a match finished, a skin bought);
 * rewards are added to the PIXELS balance at once, under the same row lock as every other balance change.
 * Methods join the caller's transaction when there is one (match results), otherwise they open their own.
 */
@Service
public class ProgressService {
    private static final Logger log = LoggerFactory.getLogger(ProgressService.class);

    private final UserRepository users;
    private final AchievementRepository achievements;
    private final DailyQuestRepository quests;
    private final SeasonResultRepository seasonResults;
    private final TransactionTemplate tx;
    /** always a fresh transaction, committed at once: used only to create a day's quest rows */
    private final TransactionTemplate newTx;
    /**
     * Quest rows for a day are created on first use, one creation at a time and committed immediately, so two
     * requests never insert them twice. Nothing else happens under this lock (no user row locks), so it cannot
     * deadlock with the match and purchase transactions.
     */
    private final Object questLock = new Object();

    public ProgressService(UserRepository users, AchievementRepository achievements, DailyQuestRepository quests,
                           SeasonResultRepository seasonResults, PlatformTransactionManager tm) {
        this.users = users;
        this.achievements = achievements;
        this.quests = quests;
        this.seasonResults = seasonResults;
        this.tx = new TransactionTemplate(tm);
        this.newTx = new TransactionTemplate(tm);
        this.newTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    // ---------------------------------------------------------------- events

    /** A player's own verified solution opened a door (not the 4-minute auto-open). */
    public void onDoorSolved(long userId, String difficulty) {
        try {
            ensureQuests(userId); // before the row lock, see questLock
            tx.executeWithoutResult(st -> users.findByIdForUpdate(userId).filter(u -> !u.isBot()).ifPresent(u -> {
                u.setDoorsSolved(u.getDoorsSolved() + 1);
                boolean hard = "HARD".equals(difficulty);
                if (hard) {
                    u.setHardDoorsSolved(u.getHardDoorsSolved() + 1);
                }
                advance(u, Quests.Kind.DOORS, 1);
                if (hard || "MEDIUM".equals(difficulty)) {
                    advance(u, Quests.Kind.TOUGH_DOORS, 1);
                }
                checkCounters(u);
                users.save(u);
            }));
        } catch (RuntimeException e) {
            // progress must never break the match itself
            log.error("Could not record a solved door for user {}", userId, e);
        }
    }

    /**
     * Called by MatchResultService inside its transaction, after results, ratings and wins are set.
     * Cancelled matches and no-shows count for nothing.
     */
    public void onMatchFinished(Room room) {
        String reason = room.getResultReason();
        if ("VOID".equals(reason) || "SERVER_RESTART".equals(reason) || "NO_SHOW".equals(reason)) {
            return;
        }
        boolean bot = room.isBotMatch();
        boolean ranked = room.isRanked() && !bot;
        for (Player p : room.getPlayers()) {
            String result = p.getResult();
            if (p.getUserId() == null || result == null || "VOID".equals(result)) {
                continue;
            }
            User u = users.findByIdForUpdate(p.getUserId()).orElse(null);
            if (u == null || u.isBot()) {
                continue;
            }
            ensureQuests(u.getId());
            boolean win = "WIN".equals(result);
            if (ranked) {
                u.setSeasonMatches(u.getSeasonMatches() + 1);
                u.setWinStreak(win ? u.getWinStreak() + 1 : 0);
                advance(u, Quests.Kind.RANKED, 1);
            }
            if (ranked || bot) { // friendly rooms do not feed quests: two friends could farm them
                advance(u, Quests.Kind.PLAY, 1);
                if (win) {
                    advance(u, Quests.Kind.WIN, 1);
                }
            }
            if (bot && win) {
                unlock(u, Achievements.BOT_SLAYER);
            }
            if (!ranked && !bot) {
                unlock(u, Achievements.FRIENDLY);
            }
            checkCounters(u);
            users.save(u);
        }
    }

    /** First skin bought in the store. Runs inside the purchase transaction (the row is already locked). */
    public void onSkinBought(User u) {
        unlock(u, Achievements.COLLECTOR);
    }

    // ---------------------------------------------------------------- views

    /** Today's three quests (created on first use). */
    public List<DailyQuest> questsToday(long userId) {
        return ensureQuests(userId);
    }

    /**
     * Rewards the player has not seen on the PROGRESS screen yet: completed quests, new achievements and
     * season places (closed after the last visit). Before the first visit everything counts.
     */
    public long unseen(User u, List<com.example.game_backend.entity.SeasonResult> badges,
                       java.util.function.LongFunction<Instant> seasonClosedAt) {
        Instant since = u.getProgressSeenAt() == null ? Instant.EPOCH : u.getProgressSeenAt();
        long n = quests.countByUserIdAndCompletedAtAfter(u.getId(), since)
                + achievements.countByUserIdAndUnlockedAtAfter(u.getId(), since);
        for (com.example.game_backend.entity.SeasonResult r : badges) {
            Instant closed = seasonClosedAt.apply(r.getSeasonId());
            if (closed != null && closed.isAfter(since)) {
                n++;
            }
        }
        return n;
    }

    /** PIXELS for the n-th day in a row: 20, 30, 40, 50, 60, 80, then 100 every day */
    static final int[] STREAK_REWARDS = {20, 30, 40, 50, 60, 80, 100};

    public static int streakReward(int day) {
        return STREAK_REWARDS[Math.min(Math.max(day, 1), STREAK_REWARDS.length) - 1];
    }

    /** The streak as it stands today: 0 if the player missed a day (it restarts at their next visit). */
    public static int currentStreak(User u, LocalDate today) {
        LocalDate last = u.getLastLoginDay();
        return last != null && !last.isBefore(today.minusDays(1)) ? u.getLoginStreak() : 0;
    }

    /**
     * First visit of the UTC day: extends the streak (or starts a new one) and pays its reward. Later calls the
     * same day change nothing. Returns claimed, streak, reward and tomorrow's reward.
     */
    public java.util.Map<String, Object> dailyLogin(long userId) {
        return tx.execute(st -> {
            User u = users.findByIdForUpdate(userId).orElseThrow();
            LocalDate today = today();
            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
            if (u.isBot() || today.equals(u.getLastLoginDay())) {
                m.put("claimed", false);
                m.put("reward", 0);
            } else {
                int streak = today.minusDays(1).equals(u.getLastLoginDay()) ? u.getLoginStreak() + 1 : 1;
                int reward = streakReward(streak);
                u.setLoginStreak(streak);
                u.setLastLoginDay(today);
                u.setPixels(u.getPixels() + reward);
                users.save(u);
                m.put("claimed", true);
                m.put("reward", reward);
            }
            m.put("streak", currentStreak(u, today));
            m.put("nextReward", streakReward(currentStreak(u, today) + 1));
            m.put("balance", u.getPixels());
            return m;
        });
    }

    public void markSeen(long userId) {
        tx.executeWithoutResult(st -> users.findByIdForUpdate(userId).ifPresent(u -> {
            u.setProgressSeenAt(Instant.now());
            users.save(u);
        }));
    }

    public List<AchievementUnlock> unlocked(long userId) {
        return achievements.findByUserId(userId);
    }

    public void deleteFor(long userId) {
        tx.executeWithoutResult(st -> {
            achievements.deleteByUserId(userId);
            quests.deleteByUserId(userId);
            seasonResults.deleteByUserId(userId);
        });
    }

    // ---------------------------------------------------------------- internals

    /** Today's quest rows, created (and committed) first if this is the player's first visit of the day. */
    private List<DailyQuest> ensureQuests(long userId) {
        LocalDate day = today();
        synchronized (questLock) {
            return newTx.execute(st -> {
                List<DailyQuest> list = quests.findByUserIdAndDayOrderByIdAsc(userId, day);
                if (!list.isEmpty()) {
                    return list;
                }
                List<DailyQuest> created = new ArrayList<>();
                for (Quests.Def d : Quests.forDay(userId, day)) {
                    created.add(quests.save(new DailyQuest(userId, day, d.code(), d.target(), d.reward())));
                }
                return created;
            });
        }
    }

    /** Moves today's quests of this kind forward; a quest that reaches its target pays out once. */
    private void advance(User u, Quests.Kind kind, int amount) {
        Instant now = Instant.now();
        // re-read inside the caller's transaction (the user row is locked, so no one else changes these now)
        for (DailyQuest q : quests.findByUserIdAndDayOrderByIdAsc(u.getId(), today())) {
            if (q.getCompletedAt() != null || Quests.get(q.getCode()).kind() != kind) {
                continue;
            }
            q.setProgress(Math.min(q.getTarget(), q.getProgress() + amount));
            if (q.getProgress() >= q.getTarget()) {
                q.setCompletedAt(now);
                u.setPixels(u.getPixels() + q.getReward());
            }
            quests.save(q);
        }
    }

    /** Achievements that follow a counter (doors, wins, streak, rating). */
    private void checkCounters(User u) {
        for (Achievements.Def d : Achievements.ALL) {
            if (d.counter() != null && d.counter().applyAsInt(u) >= d.target()) {
                unlock(u, d.code());
            }
        }
    }

    private void unlock(User u, String code) {
        if (achievements.existsByUserIdAndCode(u.getId(), code)) {
            return;
        }
        achievements.save(new AchievementUnlock(u.getId(), code, Instant.now()));
        u.setPixels(u.getPixels() + Achievements.get(code).reward());
    }
}
