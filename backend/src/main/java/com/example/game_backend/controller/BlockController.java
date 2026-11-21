package com.example.game_backend.controller;

import com.example.game_backend.security.TokenService;
import com.example.game_backend.social.BlockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/blocks")
public class BlockController {
    private final BlockService blocks;
    private final TokenService tokens;

    public BlockController(BlockService blocks, TokenService tokens) {
        this.blocks = blocks;
        this.tokens = tokens;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(blocks.list(tokens.requireUserId(auth)));
    }

    @PostMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> block(@PathVariable long userId,
                                                     @RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(blocks.block(tokens.requireUserId(auth), userId));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> unblock(@PathVariable long userId,
                                        @RequestHeader(value = "Authorization", required = false) String auth) {
        blocks.unblock(tokens.requireUserId(auth), userId);
        return ResponseEntity.noContent().build();
    }
}
