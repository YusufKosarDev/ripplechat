package com.ripplechat.backend.message.dto;

import java.util.UUID;

/**
 * Broadcast on /topic/channels/{channelId}/thread-updates so the main feed's
 * "N replies" indicator updates live.
 */
public record ThreadUpdate(
        UUID parentMessageId,
        ThreadSummary thread
) {
}
