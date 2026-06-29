package com.ripplechat.backend.webhook;

import java.time.Instant;
import java.util.UUID;

/**
 * A webhook as returned by the API. {@code url} is populated only on creation
 * (the token is shown once); list responses leave it null.
 */
public record WebhookResponse(
        UUID id,
        UUID channelId,
        String name,
        String botUsername,
        Instant createdAt,
        String url
) {
    public static WebhookResponse created(Webhook webhook, String url) {
        return new WebhookResponse(webhook.getId(), webhook.getChannel().getId(), webhook.getName(),
                webhook.getBotUser().getUsername(), webhook.getCreatedAt(), url);
    }

    public static WebhookResponse from(Webhook webhook) {
        return new WebhookResponse(webhook.getId(), webhook.getChannel().getId(), webhook.getName(),
                webhook.getBotUser().getUsername(), webhook.getCreatedAt(), null);
    }
}
