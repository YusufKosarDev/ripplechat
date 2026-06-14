package com.ripplechat.backend.push;

import java.util.UUID;

/** Published after a message is committed, so push notifications can be sent. */
public record MessageSentEvent(
        UUID channelId,
        UUID messageId,
        String senderUsername
) {
}
