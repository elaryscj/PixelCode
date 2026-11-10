package com.example.game_backend.controller;

import com.example.game_backend.dto.MoveMessage;
import com.example.game_backend.game.GameService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

@Controller
public class GameSocketController {
    private final GameService games;

    public GameSocketController(GameService games) {
        this.games = games;
    }

    /** Position + heartbeat (US-14, US-33). */
    @MessageMapping("/game/move")
    public void move(@Payload MoveMessage message) {
        if (message != null) {
            games.onMove(message.token, message.roomCode, message.x, message.y);
        }
    }
}
