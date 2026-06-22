package com.ripplechat.backend.user.dto;

import com.ripplechat.backend.user.User;

import java.time.Instant;
import java.util.UUID;

/**
 * Safe public view of a user (no email, no password). Used when a user is
 * embedded in another resource, e.g. a channel creator or message sender.
 */
public record UserSummary(
        UUID id,
        String username,
        String displayName,
        String avatarColor,
        String avatarUrl,
        Instant lastSeenAt,
        String publicKey
) {
    public static UserSummary from(User user) {
        return new UserSummary(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getAvatarColor(), user.getAvatarUrl(), user.getLastSeenAt(), user.getPublicKey());
    }
}
