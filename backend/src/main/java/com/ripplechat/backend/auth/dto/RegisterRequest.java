package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(

        @NotBlank(message = "username is required")
        @Size(max = 30, message = "username must be at most 30 characters")
        String username,

        @NotBlank(message = "email is required")
        @Email(message = "email must be valid")
        @Size(max = 254, message = "email must be at most 254 characters")
        String email,

        @Size(max = 50, message = "display name must be at most 50 characters")
        String displayName,

        @NotBlank(message = "password is required")
        @Size(min = 8, max = 100, message = "password must be 8-100 characters")
        String password
) {
}
