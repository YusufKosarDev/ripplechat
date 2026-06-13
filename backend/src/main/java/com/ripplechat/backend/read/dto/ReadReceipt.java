package com.ripplechat.backend.read.dto;

import java.time.Instant;
import java.util.UUID;

/** A user's read position in a channel, broadcast on read and returned on load. */
public record ReadReceipt(
        UUID channelId,
        UUID userId,
        Instant lastReadAt
) {
}
