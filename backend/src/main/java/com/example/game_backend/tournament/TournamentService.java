package com.example.game_backend.tournament;

import com.example.game_backend.entity.Player;
import com.example.game_backend.entity.Room;
import com.example.game_backend.entity.TournamentEntry;
import com.example.game_backend.entity.TournamentWeekend;
import com.example.game_backend.entity.User;
import com.example.game_backend.repository.TournamentEntryRepository;
import com.example.game_backend.repository.TournamentWeekendRepository;
import com.example.game_backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Weekend tournament: from Saturday 00:00 to Monday 00:00 (Kazakhstan time by default) every Quick Play match
 * scores points - a win over a player 3, a draw 1, a win over PIXEL_BOT 1. Friendly rooms do not count.
 * On Monday the top three with at least MIN_MATCHES matches receive PIXELS.
 */
@Service
public class TournamentService {
    private static final Logger log = LoggerFactory.getLogger(TournamentService.class);
    public static final int MIN_MATCHES = 3;
    public static final int[] PRIZES = {500, 300, 200};
    public static final int WIN = 3, DRAW = 1, BOT_WIN = 1;
    private static final int TOP = 20;

    private final TournamentEntryRepository entries;
    private final TournamentWeekendRepository weekends;
    private final UserRepository users;
    private final TransactionTemplate tx;
    private final ZoneId zone;

    public TournamentService(TournamentEntryRepository entries, TournamentWeekendRepository weekends,
                             UserRepository users, PlatformTransactionManager tm,
                             @Value("${game.tournament-zone:Asia/Almaty}") String zone) {
        this.entries = entries;
        this.weekends = weekends;
        this.users = users;
        this.tx = new TransactionTemplate(tm);
        this.zone = ZoneId.of(zone);
    }

    /** The Saturday of the weekend this moment belongs to, or null on a weekday. */
    LocalDate weekendOf(Instant t) {
        LocalDate d = t.atZone(zone).toLocalDate();
        DayOfWeek day = d.getDayOfWeek();
        if (day == DayOfWeek.SATURDAY) {
            return d;
        }
        if (day == DayOfWeek.SUNDAY) {
            return d.minusDays(1);
        }
        return null;
    }

    /** The coming (or running) weekend. */
    LocalDate currentOrNext(Instant now) {
        LocalDate w = weekendOf(now);
        if (w != null) {
            return w;
        }
        LocalDate d = now.atZone(zone).toLocalDate();
        while (d.getDayOfWeek() != DayOfWeek.SATURDAY) {
            d = d.plusDays(1);
        }
        return d;
    }

    /** The last weekend that is already over. */
    LocalDate lastFinished(Instant now) {
        LocalDate d = now.atZone(zone).toLocalDate();
        while (d.getDayOfWeek() != DayOfWeek.SATURDAY || end(d).isAfter(now)) {
            d = d.minusDays(1);
        }
        return d;
    }

    Instant start(LocalDate saturday) {
        return saturday.atStartOfDay(zone).toInstant();
    }

    Instant end(LocalDate saturday) {
        return saturday.plusDays(2).atStartOfDay(zone).toInstant();
    }

    static int pointsFor(String result, boolean bot) {
        if ("WIN".equals(result)) {
            return bot ? BOT_WIN : WIN;
        }
        if ("DRAW".equals(result) && !bot) {
            return DRAW;
        }
        return 0;
    }

    /** Called inside the transaction that finalizes a match. */
    public void onMatchFinished(Room room) {
        String reason = room.getResultReason();
        if ("VOID".equals(reason) || "SERVER_RESTART".equals(reason) || "NO_SHOW".equals(reason)) {
            return;
        }
        boolean bot = room.isBotMatch();
        if (!room.isRanked() && !bot) {
            return; // friendly room
        }
        Instant at = room.getFinishedAt() != null ? room.getFinishedAt() : Instant.now();
        LocalDate weekend = weekendOf(at);
        if (weekend == null) {
            return;
        }
        for (Player p : room.getPlayers()) {
            if (p.getUserId() == null || p.getResult() == null || "VOID".equals(p.getResult())) {
                continue;
            }
            User u = users.findById(p.getUserId()).orElse(null);
            if (u == null || u.isBot()) {
                continue;
            }
            TournamentEntry e = entries.findByWeekendAndUserId(weekend, u.getId())
                    .orElseGet(() -> new TournamentEntry(weekend, u.getId()));
            int pts = pointsFor(p.getResult(), bot);
            e.setPlayed(e.getPlayed() + 1);
            if ("WIN".equals(p.getResult())) {
                e.setWins(e.getWins() + 1);
            }
            if (pts > 0 || e.getUpdatedAt() == null) {
                e.setPoints(e.getPoints() + pts);
                e.setUpdatedAt(at);
            }
            entries.save(e);
        }
    }

    /** Every minute: hands out the prizes of the weekend that just ended (once). */
    public synchronized void payOut() {
        Instant now = Instant.now();
        LocalDate last = lastFinished(now);
        if (weekends.existsById(last)) {
            return;
        }
        tx.executeWithoutResult(st -> {
            List<TournamentEntry> top = entries.standings(last, PageRequest.of(0, 50));
            int place = 0;
            for (TournamentEntry e : top) {
                if (place >= PRIZES.length) {
                    break;
                }
                if (e.getPlayed() < MIN_MATCHES || e.getPoints() <= 0) {
                    continue;
                }
                User u = users.findByIdForUpdate(e.getUserId()).orElse(null);
                if (u == null) {
                    continue;
                }
                int prize = PRIZES[place];
                place++;
                e.setPlace(place);
                e.setPrize(prize);
                entries.save(e);
                u.setPixels(u.getPixels() + prize);
                users.save(u);
                log.info("Weekend tournament {}: place {} {} (+{} PIXELS)", last, place, u.getUsername(), prize);
            }
            weekends.save(new TournamentWeekend(last));
        });
    }

    public Map<String, Object> view(Long me) {
        Instant now = Instant.now();
        LocalDate w = currentOrNext(now);
        boolean active = weekendOf(now) != null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("active", active);
        out.put("weekend", w.toString());
        out.put("startsAt", start(w).toEpochMilli());
        out.put("endsAt", end(w).toEpochMilli());
        out.put("serverTime", now.toEpochMilli());
        out.put("prizes", PRIZES);
        out.put("minMatches", MIN_MATCHES);
        out.put("points", Map.of("win", WIN, "draw", DRAW, "botWin", BOT_WIN));
        out.put("players", entries.countByWeekend(w));
        out.put("top", standings(w));
        Map<String, Object> mine = null;
        if (me != null) {
            TournamentEntry e = entries.findByWeekendAndUserId(w, me).orElse(null);
            if (e != null) {
                mine = row(e, (int) entries.countAhead(w, e.getPoints(), e.getWins()) + 1, null);
            }
        }
        out.put("me", mine);
        LocalDate last = lastFinished(now);
        Map<String, Object> lastView = new LinkedHashMap<>();
        lastView.put("weekend", last.toString());
        List<Map<String, Object>> winners = new ArrayList<>();
        for (TournamentEntry e : entries.winners(last)) {
            winners.add(row(e, e.getPlace(), name(e.getUserId())));
        }
        lastView.put("winners", winners);
        out.put("last", lastView);
        return out;
    }

    private List<Map<String, Object>> standings(LocalDate w) {
        List<Map<String, Object>> top = new ArrayList<>();
        Map<Long, String> names = new HashMap<>();
        int place = 0;
        for (TournamentEntry e : entries.standings(w, PageRequest.of(0, TOP))) {
            place++;
            top.add(row(e, place, names.computeIfAbsent(e.getUserId(), this::name)));
        }
        return top;
    }

    private String name(Long id) {
        return users.findById(id).map(User::getUsername).orElse("?");
    }

    private static Map<String, Object> row(TournamentEntry e, int place, String name) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("place", place);
        m.put("userId", e.getUserId());
        if (name != null) {
            m.put("nickname", name);
        }
        m.put("points", e.getPoints());
        m.put("wins", e.getWins());
        m.put("played", e.getPlayed());
        m.put("prize", e.getPrize());
        return m;
    }

    public void deleteFor(long userId) {
        tx.executeWithoutResult(st -> entries.deleteAllFor(userId));
    }
}
