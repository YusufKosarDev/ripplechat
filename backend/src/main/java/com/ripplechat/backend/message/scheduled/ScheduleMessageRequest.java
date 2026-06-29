package com.ripplechat.backend.message.scheduled;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/** Schedule a plain-text message to a channel for a future instant. */
public record ScheduleMessageRequest(

        @Size(max = 4000, message = "content must be at most 4000 characters")
        String content,

        @NotNull(message = "scheduledAt is required")
        Instant scheduledAt
) {
}
