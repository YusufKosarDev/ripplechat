package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(

        @NotBlank(message = "email is required")
        @Email(message = "email must be valid")
        String email
) {
}
