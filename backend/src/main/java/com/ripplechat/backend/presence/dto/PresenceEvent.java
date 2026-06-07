package com.ripplechat.backend.presence.dto;

import com.ripplechat.backend.presence.PresenceStatus;

import java.util.UUID;

/**
 * Broadcast on /topic/presence when a user comes online or goes offline.
 */
public record PresenceEvent(
        UUID userId,
        String username,
        String displayName,
        PresenceStatus status
) {
}
