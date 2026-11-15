package com.example.game_backend.game;

import com.example.game_backend.entity.User;
import com.example.game_backend.repository.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * The built-in opponent for Quick Play when no human shows up in time. It is a real user row (rooms and match
 * history refer to players by user id) flagged as bot: it cannot log in, is left out of the leaderboard and
 * never changes rating.
 */
@Component
public class BotAccount implements ApplicationRunner {
    public static final String NAME = "PIXEL_BOT";
    private final UserRepository users;
    private volatile Long id;

    public BotAccount(UserRepository users) {
        this.users = users;
    }

    @Override
    public void run(ApplicationArguments args) {
        id();
    }

    public synchronized long id() {
        if (id != null) {
            return id;
        }
        User bot = users.findFirstByBotTrue().orElseGet(() -> {
            // never take over a human account that happens to use the name
            String name = NAME;
            for (int i = 2; users.existsByUsernameIgnoreCase(name); i++) {
                name = NAME + i;
            }
            User u = new User(name, "!" + UUID.randomUUID()); // not a valid hash: no password can ever match
            u.setBot(true);
            u.setActiveSkin("crimson_cipher");
            return users.save(u);
        });
        id = bot.getId();
        return id;
    }

    public boolean isBot(Long userId) {
        return userId != null && userId == id();
    }
}
