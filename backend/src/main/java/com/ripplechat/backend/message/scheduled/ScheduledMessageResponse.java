package com.ripplechat.backend.message.scheduled;

import java.time.Instant;
import java.util.UUID;

/** A pending scheduled message, as shown in the "scheduled" list. */
public record ScheduledMessageResponse(
        UUID id,
        UUID channelId,
        String channelName,
        String content,
        Instant scheduledAt
) {
    public static ScheduledMessageResponse from(ScheduledMessage sm) {
        return new ScheduledMessageResponse(
                sm.getId(),
                sm.getChannel().getId(),
                sm.getChannel().getName(),
                sm.getContent(),
                sm.getScheduledAt());
    }
}
