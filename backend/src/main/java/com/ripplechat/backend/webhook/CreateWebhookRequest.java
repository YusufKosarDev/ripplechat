package com.ripplechat.backend.webhook;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Create an incoming webhook with a display name for its bot identity. */
public record CreateWebhookRequest(
        @NotBlank(message = "name is required")
        @Size(max = 80, message = "name must be at most 80 characters")
        String name
) {
}
