package com.ripplechat.backend.message.dto;

import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MessageResponse(
        UUID id,
        String content,
        UUID channelId,
        UserSummary sender,
        Instant createdAt,
        List<ReactionSummary> reactions,
        UUID parentMessageId,
        ThreadSummary thread,
        Instant editedAt,
        boolean deleted,
        String attachmentUrl
) {
    public static MessageResponse from(Message message) {
        return from(message, List.of(), ThreadSummary.empty());
    }

    public static MessageResponse from(Message message, List<ReactionSummary> reactions, ThreadSummary thread) {
        return new MessageResponse(
                message.getId(),
                message.getContent(),
                message.getChannel().getId(),
                UserSummary.from(message.getSender()),
                message.getCreatedAt(),
                reactions,
                message.getParent() != null ? message.getParent().getId() : null,
                thread,
                message.getEditedAt(),
                message.isDeleted(),
                message.getAttachmentUrl());
    }
}
