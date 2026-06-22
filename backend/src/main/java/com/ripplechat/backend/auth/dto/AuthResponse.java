package com.ripplechat.backend.auth.dto;

import com.ripplechat.backend.user.dto.UserResponse;

/**
 * Returned by register/login: a short-lived access token, the longer-lived
 * refresh token (used to renew the access token), and the authenticated user.
 */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        UserResponse user,
        Boolean requires2Fa,
        String preAuthToken
) {
    public static AuthResponse of(String accessToken, String refreshToken, UserResponse user) {
        return new AuthResponse(accessToken, refreshToken, "Bearer", user, false, null);
    }
    
    public static AuthResponse requires2Fa(String preAuthToken) {
        return new AuthResponse(null, null, null, null, true, preAuthToken);
    }
}
