package com.ripplechat.backend.user.dto;

import jakarta.validation.constraints.Size;

/**
 * Sets (or, with empty emoji and text, clears) the caller's custom status.
 * {@code expiresInMinutes} is optional; null or non-positive means no auto-expiry.
 */
public record SetStatusRequest(
        @Size(max = 16, message = "status emoji must be at most 16 characters")
        String emoji,

        @Size(max = 100, message = "status text must be at most 100 characters")
        String text,

        Long expiresInMinutes
) {
}
