package com.ripplechat.backend.channel.dto;

import java.util.UUID;

/**
 * Broadcast on /topic/channels/{channelId}/deleted when a channel is deleted.
 */
public record ChannelDeletedEvent(
        UUID channelId
) {
}
