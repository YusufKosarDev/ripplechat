package com.ripplechat.backend.user.dto;

/**
 * Self profile update. All fields optional; only non-null/non-blank ones apply.
 * Username is immutable and not accepted here.
 */
public record UpdateMeRequest(
        String displayName,
        String email,
        String avatarColor
) {
}
