package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * {@code login} accepts either a username or an email.
 */
public record LoginRequest(

        @NotBlank(message = "login is required")
        String login,

        @NotBlank(message = "password is required")
        String password
) {
}
