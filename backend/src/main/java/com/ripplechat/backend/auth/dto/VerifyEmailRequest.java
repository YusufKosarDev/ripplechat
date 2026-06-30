package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyEmailRequest(

        @NotBlank(message = "token is required")
        String token
) {
}
