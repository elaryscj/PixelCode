package com.example.game_backend.controller;

import com.example.game_backend.security.TokenService;
import com.example.game_backend.service.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {
    private final RoomService roomService;
    private final TokenService tokens;

    public RoomController(RoomService roomService, TokenService tokens) {
        this.roomService = roomService;
        this.tokens = tokens;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(roomService.createRoom(tokens.requireUserId(auth)));
    }

    @GetMapping("/mine")
    public ResponseEntity<Map<String, Object>> mine(@RequestHeader(value = "Authorization", required = false) String auth) {
        Map<String, Object> room = roomService.mine(tokens.requireUserId(auth));
        return room == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(room);
    }

    @GetMapping("/{code}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String code) {
        return ResponseEntity.ok(roomService.getRoom(code));
    }

    @PostMapping("/{code}/join")
    public ResponseEntity<Map<String, Object>> join(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(roomService.joinRoom(code, tokens.requireUserId(auth)));
    }

    @PostMapping("/{code}/ready")
    public ResponseEntity<Map<String, Object>> ready(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(roomService.ready(code, tokens.requireUserId(auth)));
    }

    @PostMapping("/{code}/vote")
    public ResponseEntity<Map<String, Object>> vote(@PathVariable String code, @RequestBody Map<String, Object> body,
                                                    @RequestHeader(value = "Authorization", required = false) String auth) {
        Object raw = body == null ? null : body.get("mapId");
        Integer mapId = raw instanceof Number n ? n.intValue() : null;
        return ResponseEntity.ok(roomService.vote(code, tokens.requireUserId(auth), mapId));
    }

    /** After a finished match: open (or join) a friendly rematch room with the same rival. */
    @PostMapping("/{code}/rematch")
    public ResponseEntity<Map<String, Object>> rematch(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(roomService.rematch(code, tokens.requireUserId(auth)));
    }

    @PostMapping("/{code}/leave")
    public ResponseEntity<Void> leave(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) {
        roomService.leave(code, tokens.requireUserId(auth));
        return ResponseEntity.noContent().build();
    }
}
