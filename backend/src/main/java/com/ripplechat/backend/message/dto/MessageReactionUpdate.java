package com.ripplechat.backend.message.dto;

import java.util.List;
import java.util.UUID;

/**
 * Broadcast on /topic/channels/{channelId}/message-reactions when a message's
 * reactions change.
 */
public record MessageReactionUpdate(
        UUID messageId,
        List<ReactionSummary> reactions
) {
}
