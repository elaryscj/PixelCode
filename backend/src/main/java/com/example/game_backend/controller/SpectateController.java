package com.example.game_backend.controller;

import com.example.game_backend.entity.Friendship;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.GameService;
import com.example.game_backend.repository.FriendshipRepository;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import com.example.game_backend.social.BlockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Spectator mode: a friend of either player (not blocked by them) or an admin may watch a running match.
 * Live moves come over the same WebSocket topic the players use; this endpoint gives the full picture.
 */
@RestController
public class SpectateController {
    private final GameService games;
    private final TokenService tokens;
    private final FriendshipRepository friendships;
    private final BlockService blocks;
    private final UserRepository users;

    public SpectateController(GameService games, TokenService tokens, FriendshipRepository friendships,
                              BlockService blocks, UserRepository users) {
        this.games = games;
        this.tokens = tokens;
        this.friendships = friendships;
        this.blocks = blocks;
        this.users = users;
    }

    @GetMapping("/api/games/{code}/watch")
    public ResponseEntity<Map<String, Object>> watch(@PathVariable String code,
                                                     @RequestHeader(value = "Authorization", required = false) String auth) {
        long me = tokens.requireUserId(auth);
        String c = code.toUpperCase();
        List<Long> players = games.playersOf(c);
        if (players.contains(me)) {
            throw new ApiException(409, "You are a player in this match").with("player", true);
        }
        boolean admin = users.findById(me).map(User::isAdmin).orElse(false);
        boolean friend = false;
        for (Long p : players) {
            if (blocks.blockedEitherWay(me, p)) {
                throw new ApiException(403, "Only friends of the players can watch this match");
            }
            if (friendships.findPair(me, p).map(Friendship::isAccepted).orElse(false)) {
                friend = true;
            }
        }
        if (!friend && !admin) {
            throw new ApiException(403, "Only friends of the players can watch this match");
        }
        return ResponseEntity.ok(games.watch(c, me));
    }
}
