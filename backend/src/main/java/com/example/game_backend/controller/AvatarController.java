package com.example.game_backend.controller;

import com.example.game_backend.entity.User;
import com.example.game_backend.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Base64;

/** Public avatar pictures, so other players' avatars can be shown in lobbies, matches and the leaderboard. */
@RestController
@RequestMapping("/api/avatars")
public class AvatarController {
    private final UserRepository users;

    public AvatarController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> get(@PathVariable long id) {
        User u = users.findById(id).orElse(null);
        String data = u == null ? null : u.getAvatarUrl();
        int comma = data == null ? -1 : data.indexOf(',');
        if (comma < 0 || !data.startsWith("data:image/")) {
            return ResponseEntity.notFound().build();
        }
        String type = data.substring(5, comma).split(";")[0];
        if (!type.matches("image/(png|jpeg|webp|gif)")) {
            return ResponseEntity.notFound().build();
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(data.substring(comma + 1));
            return ResponseEntity.ok()
                    .header("Content-Type", type)
                    .header("Cache-Control", "public, max-age=30")
                    .header("X-Content-Type-Options", "nosniff")
                    .body(bytes);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
