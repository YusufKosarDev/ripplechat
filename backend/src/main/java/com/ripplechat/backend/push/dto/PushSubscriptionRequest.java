package com.ripplechat.backend.push.dto;

import jakarta.validation.constraints.NotBlank;

/** Browser PushSubscription payload sent by the client to register for push. */
public record PushSubscriptionRequest(
        @NotBlank String endpoint,
        @NotBlank String p256dh,
        @NotBlank String auth
) {
}
