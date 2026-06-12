package com.ripplechat.backend.auth.dto;

/**
 * Returned by /api/auth/refresh: a fresh access token plus a rotated refresh
 * token (the previous refresh token is invalidated on use).
 */
public record TokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType
) {
    public static TokenResponse of(String accessToken, String refreshToken) {
        return new TokenResponse(accessToken, refreshToken, "Bearer");
    }
}
