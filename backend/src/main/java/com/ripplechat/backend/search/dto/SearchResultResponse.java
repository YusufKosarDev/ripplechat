package com.ripplechat.backend.search.dto;

import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;
import java.util.UUID;

public record SearchResultResponse(
        UUID id,
        String content,
        UUID channelId,
        String channelName,
        UserSummary sender,
        Instant createdAt
) {
    public static SearchResultResponse from(Message message) {
        return new SearchResultResponse(
                message.getId(),
                message.getContent(),
                message.getChannel().getId(),
                message.getChannel().getName(),
                UserSummary.from(message.getSender()),
                message.getCreatedAt());
    }
}
