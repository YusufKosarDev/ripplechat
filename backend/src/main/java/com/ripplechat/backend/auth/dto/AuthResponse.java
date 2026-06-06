package com.ripplechat.backend.auth.dto;

import com.ripplechat.backend.user.dto.UserResponse;

/**
 * Returned by register/login: the access token plus the authenticated user.
 */
public record AuthResponse(
        String accessToken,
        String tokenType,
        UserResponse user
) {
    public static AuthResponse bearer(String token, UserResponse user) {
        return new AuthResponse(token, "Bearer", user);
    }
}
