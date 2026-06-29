package com.ripplechat.backend.user.dto;

import com.ripplechat.backend.user.User;

import java.time.Instant;
import java.util.UUID;

/**
 * What we expose over the API for a user.
 */
public record UserResponse(
        UUID id,
        String username,
        String email,
        String displayName,
        String avatarColor,
        String avatarUrl,
        Instant createdAt,
        boolean isTwoFactorEnabled,
        String publicKey,
        String statusEmoji,
        String statusText,
        Instant statusExpiresAt,
        Instant dndUntil
) {
    public static UserResponse from(User user) {
        boolean status = user.isStatusActive();
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                user.getAvatarColor(),
                user.getAvatarUrl(),
                user.getCreatedAt(),
                user.isTwoFactorEnabled(),
                user.getPublicKey(),
                status ? user.getStatusEmoji() : null,
                status ? user.getStatusText() : null,
                status ? user.getStatusExpiresAt() : null,
                user.isDndActive() ? user.getDndUntil() : null
        );
    }
}
