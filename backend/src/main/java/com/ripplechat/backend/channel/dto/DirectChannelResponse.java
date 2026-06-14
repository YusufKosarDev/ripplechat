package com.ripplechat.backend.channel.dto;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A direct conversation from the current user's perspective. For a one-to-one
 * DM, {@code otherUser} is the partner. For a group, {@code group} is true,
 * {@code name} is the title, and {@code participants} are the other members.
 */
public record DirectChannelResponse(
        UUID id,
        boolean group,
        String name,
        UserSummary otherUser,
        List<UserSummary> participants,
        Instant createdAt
) {
    public static DirectChannelResponse direct(Channel channel, User other) {
        UserSummary summary = UserSummary.from(other);
        return new DirectChannelResponse(channel.getId(), false, null, summary, List.of(summary), channel.getCreatedAt());
    }

    public static DirectChannelResponse group(Channel channel, List<UserSummary> participants) {
        return new DirectChannelResponse(channel.getId(), true, channel.getName(), null, participants, channel.getCreatedAt());
    }
}
