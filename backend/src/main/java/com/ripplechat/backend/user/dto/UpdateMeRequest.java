package com.ripplechat.backend.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * Self profile update. All fields optional; only non-null/non-blank ones apply.
 * Username is immutable and not accepted here.
 */
public record UpdateMeRequest(
        @Size(max = 50, message = "display name must be at most 50 characters")
        String displayName,

        @Email(message = "email must be valid")
        @Size(max = 254, message = "email must be at most 254 characters")
        String email,

        @Size(max = 32, message = "avatar color must be at most 32 characters")
        String avatarColor,

        @Size(max = 1024)
        String avatarUrl
) {
}
