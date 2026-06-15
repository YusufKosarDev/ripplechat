package com.ripplechat.backend.channel.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Sets the disappearing-messages timer for a channel. {@code ttlSeconds} null or
 * 0 turns it off; otherwise it is capped at 30 days.
 */
public record DisappearingRequest(
        @Min(value = 0, message = "ttlSeconds cannot be negative")
        @Max(value = 2592000, message = "ttlSeconds cannot exceed 30 days")
        Integer ttlSeconds
) {
}
