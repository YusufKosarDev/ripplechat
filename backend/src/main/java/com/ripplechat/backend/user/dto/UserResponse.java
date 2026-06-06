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
        Instant createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                user.getCreatedAt()
        );
    }
}
