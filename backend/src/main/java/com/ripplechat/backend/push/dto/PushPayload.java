package com.ripplechat.backend.push.dto;

import java.util.UUID;

/** Notification body delivered to the service worker. */
public record PushPayload(
        String title,
        String body,
        String url,
        Boolean encrypted,
        UUID channelId,
        UUID senderId
) {
    public PushPayload(String title, String body, String url) {
        this(title, body, url, false, null, null);
    }
}
