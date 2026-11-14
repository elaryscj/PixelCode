package com.example.game_backend.controller;

import com.example.game_backend.dto.SubmitRequest;
import com.example.game_backend.game.GameService;
import com.example.game_backend.game.ResultViews;
import com.example.game_backend.entity.Room;
import com.example.game_backend.repository.RoomRepository;
import org.springframework.data.domain.PageRequest;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/games")
public class GameController {
    private final GameService games;
    private final TokenService tokens;
    private final RoomRepository rooms;

    public GameController(GameService games, TokenService tokens, RoomRepository rooms) {
        this.games = games;
        this.tokens = tokens;
        this.rooms = rooms;
    }

    /** "See my results": the caller's last finished matches, newest first. */
    @GetMapping("/history")
    public ResponseEntity<List<Map<String, Object>>> history(@RequestParam(defaultValue = "20") int limit,
                                                             @RequestHeader(value = "Authorization", required = false) String auth) {
        long uid = tokens.requireUserId(auth);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Room r : rooms.findFinishedForUser(uid, PageRequest.of(0, Math.max(1, Math.min(limit, 50))))) {
            Map<String, Object> m = ResultViews.of(r);
            m.put("ranked", r.isRanked());
            m.put("mapId", r.getMapId());
            m.put("finishedAt", r.getFinishedAt() == null ? null : r.getFinishedAt().toEpochMilli());
            out.add(m);
        }
        return ResponseEntity.ok(out);
    }

    @GetMapping("/{code}")
    public ResponseEntity<Map<String, Object>> state(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(games.state(code.toUpperCase(), tokens.requireUserId(auth)));
    }

    private static Double num(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        return v instanceof Number n ? n.doubleValue() : null;
    }

    /** body (optional): {"x": .., "y": ..} = where the player stands; the server checks it is at the door */
    @PostMapping("/{code}/doors/{cp}/open")
    public ResponseEntity<Map<String, Object>> open(@PathVariable String code, @PathVariable int cp,
                                                    @RequestBody(required = false) Map<String, Object> body,
                                                    @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(games.openDoor(code.toUpperCase(), tokens.requireUserId(auth), cp, num(body, "x"), num(body, "y")));
    }

    @PostMapping("/{code}/doors/{cp}/submit")
    public ResponseEntity<Map<String, Object>> submit(@PathVariable String code, @PathVariable int cp,
                                                      @RequestBody SubmitRequest body, @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(games.submit(code.toUpperCase(), tokens.requireUserId(auth), cp, body == null ? null : body.code));
    }

    @PostMapping("/{code}/finish")
    public ResponseEntity<Map<String, Object>> finish(@PathVariable String code,
                                                      @RequestBody(required = false) Map<String, Object> body,
                                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(games.finish(code.toUpperCase(), tokens.requireUserId(auth), num(body, "x"), num(body, "y")));
    }
}
