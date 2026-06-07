package com.ripplechat.backend.reaction.dto;

import java.util.UUID;

/**
 * Broadcast on /topic/channels/{channelId}/reactions. Transient — never persisted.
 */
public record ReactionEvent(
        UUID userId,
        String username,
        String emoji
) {
}
