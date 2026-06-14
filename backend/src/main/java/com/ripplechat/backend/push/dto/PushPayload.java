package com.ripplechat.backend.push.dto;

/** Notification body delivered to the service worker. */
public record PushPayload(
        String title,
        String body,
        String url
) {
}
