package com.ripplechat.backend.message.dto;

import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(
        UUID id,
        String content,
        UUID channelId,
        UserSummary sender,
        Instant createdAt
) {
    public static MessageResponse from(Message message) {
        return new MessageResponse(
                message.getId(),
                message.getContent(),
                message.getChannel().getId(),
                UserSummary.from(message.getSender()),
                message.getCreatedAt()
        );
    }
}
