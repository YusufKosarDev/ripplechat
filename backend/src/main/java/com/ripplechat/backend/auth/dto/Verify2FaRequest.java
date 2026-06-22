package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record Verify2FaRequest(
        @NotBlank(message = "Pre-auth token is required")
        String preAuthToken,
        
        @NotBlank(message = "2FA code is required")
        @Size(min = 6, max = 6, message = "2FA code must be exactly 6 digits")
        String code
) {
}
