package com.ripplechat.backend.notification.dto;

import com.ripplechat.backend.notification.Notification;
import com.ripplechat.backend.user.dto.UserSummary;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        String type,
        UserSummary actor,
        UUID channelId,
        UUID messageId,
        String preview,
        boolean read,
        Instant createdAt
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getType(),
                UserSummary.from(n.getActor()),
                n.getChannelId(),
                n.getMessageId(),
                n.getPreview(),
                n.isRead(),
                n.getCreatedAt());
    }
}
