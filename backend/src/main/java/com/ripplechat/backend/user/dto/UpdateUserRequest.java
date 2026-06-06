package com.ripplechat.backend.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Payload for updating a user. {@code username} is immutable, so it is not
 * accepted here — only email and displayName can change.
 */
public record UpdateUserRequest(

        @NotBlank(message = "email is required")
        @Email(message = "email must be valid")
        String email,

        String displayName
) {
}
