package com.ripplechat.backend.message.dto;

import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;
import java.util.UUID;

/** One image attachment in a channel's media gallery. */
public record MediaItem(
        UUID messageId,
        String url,
        UserSummary sender,
        Instant createdAt
) {
    public static MediaItem from(Message message) {
        return new MediaItem(message.getId(), message.getAttachmentUrl(),
                UserSummary.from(message.getSender()), message.getCreatedAt());
    }
}
