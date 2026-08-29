package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(

        /**
         * Letters, digits, underscore and dot — the same alphabet the @mention
         * parser recognises, so every username is actually mentionable.
         *
         * <p>It was previously anything non-blank up to 30 characters, which
         * allowed a username that looks like an email address. Sign-in accepts
         * either, so registering one that matched someone else's address made
         * their email sign-in ambiguous.
         */
        @NotBlank(message = "username is required")
        @Pattern(regexp = "^[A-Za-z0-9_.]{3,30}$",
                message = "username must be 3-30 characters, using letters, digits, _ or .")
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
