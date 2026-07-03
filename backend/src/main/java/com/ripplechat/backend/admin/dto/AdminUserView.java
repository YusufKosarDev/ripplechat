package com.ripplechat.backend.admin.dto;

import com.ripplechat.backend.user.User;

import java.time.Instant;
import java.util.UUID;

/** A user as seen in the admin panel's user table. */
public record AdminUserView(
        UUID id,
        String username,
        String email,
        String displayName,
        boolean admin,
        boolean disabled,
        boolean deleted,
        boolean bot,
        Instant createdAt,
        Instant lastSeenAt
) {
    public static AdminUserView from(User user) {
        return new AdminUserView(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                user.isAdmin(),
                user.isDisabled(),
                user.isDeleted(),
                user.isBot(),
                user.getCreatedAt(),
                user.getLastSeenAt()
        );
    }
}
