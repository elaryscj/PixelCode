package com.example.game_backend.game;

import com.example.game_backend.entity.Player;
import com.example.game_backend.entity.Room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ResultViews {
    private static final Set<String> TECHNICAL = Set.of("ABSENCE", "NO_SHOW", "VOID", "SERVER_RESTART");

    private ResultViews() {
    }

    public static Map<String, Object> of(Room room) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", room.getCode());
        m.put("reason", room.getResultReason());
        m.put("technical", room.getResultReason() != null && TECHNICAL.contains(room.getResultReason()));
        m.put("winnerUserId", room.getWinnerUserId());
        m.put("durationSeconds", room.getDurationSeconds() == null ? 0L : room.getDurationSeconds());
        String winnerName = null;
        List<Map<String, Object>> players = new ArrayList<>();
        for (Player p : room.getPlayers()) {
            Map<String, Object> pm = new LinkedHashMap<>();
            int before = p.getRatingBefore() == null ? 0 : p.getRatingBefore();
            int delta = p.getRatingDelta() == null ? 0 : p.getRatingDelta();
            pm.put("userId", p.getUserId());
            pm.put("nickname", p.getNickname());
            pm.put("result", p.getResult());
            pm.put("oldRating", before);
            pm.put("delta", delta);
            pm.put("newRating", before + delta);
            players.add(pm);
            if (room.getWinnerUserId() != null && room.getWinnerUserId().equals(p.getUserId())) {
                winnerName = p.getNickname();
            }
        }
        m.put("winnerNickname", winnerName);
        m.put("players", players);
        return m;
    }
}
