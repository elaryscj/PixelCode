package com.example.game_backend.game;

import com.example.game_backend.entity.Player;
import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.RoomStatus;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.RoomRepository;
import com.example.game_backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/** Finalizes a match exactly once: result, Elo, counters, bans (US-15, US-25, US-34, US-35, NFR-07, NFR-09). */
@Service
public class MatchResultService {
    private final RoomRepository rooms;
    private final UserRepository users;
    private final TransactionTemplate tx;
    private final long banMinutes;
    private final Object lock = new Object();

    public MatchResultService(RoomRepository rooms, UserRepository users, PlatformTransactionManager tm,
                              @Value("${game.ban-minutes:30}") long banMinutes) {
        this.rooms = rooms;
        this.users = users;
        this.tx = new TransactionTemplate(tm);
        this.banMinutes = banMinutes;
    }

    public Map<String, Object> finalizeMatch(String code, Long winnerUserId, String reason,
                                             Collection<Long> bannedUsers, boolean rated) {
        synchronized (lock) {
            return tx.execute(status -> {
                Room room = rooms.findByCode(code).orElseThrow(() -> new ApiException(404, "Room not found"));
                if (room.getRoomStatus() == RoomStatus.FINISHED) {
                    return ResultViews.of(room);
                }
                Instant now = Instant.now();
                room.setRoomStatus(RoomStatus.FINISHED);
                room.setFinishedAt(now);
                room.setResultReason(reason);
                room.setWinnerUserId(winnerUserId);
                if (room.getStartedAt() != null) {
                    room.setDurationSeconds(Duration.between(room.getStartedAt(), now).getSeconds());
                }

                List<Player> ps = room.getPlayers();
                boolean draw = winnerUserId == null;
                boolean done = false;
                if (rated && ps.size() == 2) {
                    Player a = ps.get(0);
                    Player b = ps.get(1);
                    User ua = users.findById(a.getUserId()).orElse(null);
                    User ub = users.findById(b.getUserId()).orElse(null);
                    if (ua != null && ub != null) {
                        int ra = ua.getRating();
                        int rb = ub.getRating();
                        double scoreA = draw ? 0.5 : (winnerUserId.equals(a.getUserId()) ? 1.0 : 0.0);
                        applyRating(a, ua, ra, Elo.delta(ra, rb, scoreA), draw, winnerUserId);
                        applyRating(b, ub, rb, Elo.delta(rb, ra, 1.0 - scoreA), draw, winnerUserId);
                        users.save(ua);
                        users.save(ub);
                        done = true;
                    }
                }
                if (!done) {
                    for (Player p : ps) {
                        if (p.getRatingBefore() == null && p.getUserId() != null) {
                            users.findById(p.getUserId()).ifPresent(u -> p.setRatingBefore(u.getRating()));
                        }
                        p.setRatingDelta(0);
                        p.setResult(draw ? "VOID" : (winnerUserId.equals(p.getUserId()) ? "WIN" : "LOSS"));
                    }
                }
                if (bannedUsers != null) {
                    for (Long uid : bannedUsers) {
                        users.findById(uid).ifPresent(u -> {
                            u.setBannedUntil(now.plus(Duration.ofMinutes(banMinutes)));
                            users.save(u);
                        });
                    }
                }
                rooms.save(room);
                return ResultViews.of(room);
            });
        }
    }

    private static void applyRating(Player p, User u, int before, int delta, boolean draw, Long winnerUserId) {
        int after = Math.max(0, before + delta);
        p.setRatingBefore(before);
        p.setRatingDelta(after - before);
        u.setRating(after);
        if (draw) {
            p.setResult("DRAW");
            u.setPixels(u.getPixels() + 50);
        } else if (winnerUserId.equals(p.getUserId())) {
            p.setResult("WIN");
            u.setWins(u.getWins() + 1);
            u.setPixels(u.getPixels() + 150);
        } else {
            p.setResult("LOSS");
            u.setLosses(u.getLosses() + 1);
            u.setPixels(u.getPixels() + 25);
        }
    }
}
