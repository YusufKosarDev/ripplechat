package com.ripplechat.backend.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Payload for creating a user. Kept minimal — no password yet (auth step).
 */
public record CreateUserRequest(

        @NotBlank(message = "username is required")
        String username,

        @NotBlank(message = "email is required")
        @Email(message = "email must be valid")
        String email,

        String displayName
) {
}
