package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(

        @NotBlank(message = "token is required")
        String token,

        @NotBlank(message = "password is required")
        @Size(min = 8, max = 100, message = "password must be 8-100 characters")
        String newPassword
) {
}
