package com.ripplechat.backend.channel.dto;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;
import java.util.UUID;

/**
 * A direct-message conversation from the current user's perspective: the
 * underlying channel id (used for messages/WebSocket) plus the other participant
 * to display.
 */
public record DirectChannelResponse(
        UUID id,
        UserSummary otherUser,
        Instant createdAt
) {
    public static DirectChannelResponse of(Channel channel, User other) {
        return new DirectChannelResponse(channel.getId(), UserSummary.from(other), channel.getCreatedAt());
    }
}
