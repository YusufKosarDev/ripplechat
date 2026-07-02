package com.ripplechat.backend.user.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A user's own data, returned by the GDPR self-service export. Contains only the
 * requesting user's data (their profile, memberships and authored messages).
 */
public record AccountExport(
        Instant exportedAt,
        Profile profile,
        List<Membership> memberships,
        List<AuthoredMessage> messages
) {
    public record Profile(
            UUID id,
            String username,
            String email,
            String displayName,
            String avatarColor,
            String avatarUrl,
            Instant createdAt,
            boolean emailVerified,
            boolean twoFactorEnabled
    ) {}

    public record Membership(
            UUID channelId,
            String channelName,
            String role,
            Instant joinedAt
    ) {}

    public record AuthoredMessage(
            UUID id,
            UUID channelId,
            String content,
            Instant createdAt,
            boolean deleted
    ) {}
}
