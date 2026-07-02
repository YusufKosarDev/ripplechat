package com.ripplechat.backend.bookmark.dto;

import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;
import java.util.UUID;

/** A bookmarked message plus when it was saved, for the saved-items list. */
public record SavedMessageResponse(
        UUID messageId,
        UUID channelId,
        String channelName,
        UserSummary sender,
        String content,
        Instant createdAt,
        Instant savedAt
) {
    public static SavedMessageResponse from(Message message, Instant savedAt) {
        return new SavedMessageResponse(
                message.getId(),
                message.getChannel().getId(),
                message.getChannel().getName(),
                UserSummary.from(message.getSender()),
                message.getContent(),
                message.getCreatedAt(),
                savedAt);
    }
}
