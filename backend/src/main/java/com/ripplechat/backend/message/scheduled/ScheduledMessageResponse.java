package com.ripplechat.backend.message.scheduled;

import java.time.Instant;
import java.util.UUID;

/**
 * A pending scheduled message, as shown in the "scheduled" list.
 *
 * @param failureReason why the last delivery attempt failed, or null while the
 *                      message is simply waiting. A row that has used up its
 *                      attempts stays in this list rather than disappearing, so
 *                      the author is told the message never went out instead of
 *                      being left to assume it did.
 */
public record ScheduledMessageResponse(
        UUID id,
        UUID channelId,
        String channelName,
        String content,
        Instant scheduledAt,
        String failureReason
) {
    public static ScheduledMessageResponse from(ScheduledMessage sm) {
        return new ScheduledMessageResponse(
                sm.getId(),
                sm.getChannel().getId(),
                sm.getChannel().getName(),
                sm.getContent(),
                sm.getScheduledAt(),
                sm.getLastError());
    }
}
