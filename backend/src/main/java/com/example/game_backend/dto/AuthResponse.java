package com.example.game_backend.dto;

public record AuthResponse(Long id, String username, int rating, String message, String token,
                           int wins, int losses, boolean admin, int pixels, String activeSkin, String avatarUrl) {
}
