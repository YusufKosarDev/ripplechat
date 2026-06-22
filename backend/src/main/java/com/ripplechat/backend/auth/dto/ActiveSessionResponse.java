package com.ripplechat.backend.auth.dto;

import com.ripplechat.backend.auth.RefreshToken;

import java.time.Instant;
import java.util.UUID;

public record ActiveSessionResponse(
        UUID id,
        String ipAddress,
        String userAgent,
        Instant createdAt,
        Instant expiresAt
) {
    public static ActiveSessionResponse from(RefreshToken token) {
        return new ActiveSessionResponse(
                token.getId(),
                token.getIpAddress(),
                token.getUserAgent(),
                token.getCreatedAt(),
                token.getExpiresAt()
        );
    }
}
