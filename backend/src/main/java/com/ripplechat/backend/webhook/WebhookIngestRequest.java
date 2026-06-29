package com.ripplechat.backend.webhook;

import jakarta.validation.constraints.Size;

/** The payload an external system POSTs to an incoming webhook. */
public record WebhookIngestRequest(
        @Size(max = 4000, message = "text must be at most 4000 characters")
        String text
) {
}
