package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record Verify2FaRequest(
        @NotBlank(message = "Pre-auth token is required")
        String preAuthToken,
        
        // Either a 6-digit TOTP code or a recovery code (xxxxx-xxxxx). The
        // service distinguishes them, so the length range spans both.
        @NotBlank(message = "2FA code is required")
        @Size(min = 6, max = 20, message = "enter your 6-digit code or a recovery code")
        String code
) {
}
