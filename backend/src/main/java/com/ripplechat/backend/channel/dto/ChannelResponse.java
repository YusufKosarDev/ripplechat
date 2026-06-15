package com.ripplechat.backend.channel.dto;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;
import java.util.UUID;

public record ChannelResponse(
        UUID id,
        String name,
        String description,
        boolean isPrivate,
        UserSummary createdBy,
        Instant createdAt,
        Integer messageTtlSeconds
) {
    public static ChannelResponse from(Channel channel) {
        return new ChannelResponse(
                channel.getId(),
                channel.getName(),
                channel.getDescription(),
                channel.isPrivate(),
                UserSummary.from(channel.getCreatedBy()),
                channel.getCreatedAt(),
                channel.getMessageTtlSeconds()
        );
    }
}
