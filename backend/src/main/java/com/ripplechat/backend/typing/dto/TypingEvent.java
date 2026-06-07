package com.ripplechat.backend.typing.dto;

import java.util.UUID;

/**
 * Broadcast on /topic/channels/{channelId}/typing. Transient — never persisted.
 */
public record TypingEvent(
        UUID userId,
        String username,
        String displayName,
        boolean typing
) {
}
