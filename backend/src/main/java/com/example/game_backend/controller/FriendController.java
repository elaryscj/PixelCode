package com.example.game_backend.controller;

import com.example.game_backend.security.TokenService;
import com.example.game_backend.social.FriendService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/friends")
public class FriendController {
    private final FriendService friends;
    private final TokenService tokens;

    public FriendController(FriendService friends, TokenService tokens) {
        this.friends = friends;
        this.tokens = tokens;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(friends.list(tokens.requireUserId(auth)));
    }

    /** body: {"username": "..."} */
    @PostMapping("/requests")
    public ResponseEntity<Map<String, Object>> request(@RequestBody(required = false) Map<String, Object> body,
                                                       @RequestHeader(value = "Authorization", required = false) String auth) {
        Object name = body == null ? null : body.get("username");
        return ResponseEntity.ok(friends.request(tokens.requireUserId(auth), name == null ? null : name.toString()));
    }

    @PostMapping("/requests/{id}/accept")
    public ResponseEntity<Void> accept(@PathVariable long id, @RequestHeader(value = "Authorization", required = false) String auth) {
        friends.accept(tokens.requireUserId(auth), id);
        return ResponseEntity.noContent().build();
    }

    /** decline, cancel or unfriend */
    @DeleteMapping("/requests/{id}")
    public ResponseEntity<Void> remove(@PathVariable long id, @RequestHeader(value = "Authorization", required = false) String auth) {
        friends.remove(tokens.requireUserId(auth), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{userId}/challenge")
    public ResponseEntity<Map<String, Object>> challenge(@PathVariable long userId,
                                                         @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(friends.challenge(tokens.requireUserId(auth), userId));
    }

    /** Polled by the client every few seconds: duel invitations + how many friend requests wait. */
    @GetMapping("/invites")
    public ResponseEntity<Map<String, Object>> invites(@RequestHeader(value = "Authorization", required = false) String auth) {
        long me = tokens.requireUserId(auth);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("invites", friends.invitesFor(me));
        m.put("requests", friends.pendingFor(me));
        m.put("channel", tokens.inboxChannel(me));
        return ResponseEntity.ok(m);
    }

    @PostMapping("/invites/{code}/dismiss")
    public ResponseEntity<Void> dismiss(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) {
        friends.dismissInvite(tokens.requireUserId(auth), code);
        return ResponseEntity.noContent().build();
    }
}
