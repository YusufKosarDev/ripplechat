package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** Body for /api/auth/refresh and /api/auth/logout. */
public record RefreshRequest(
        @NotBlank String refreshToken
) {
}
