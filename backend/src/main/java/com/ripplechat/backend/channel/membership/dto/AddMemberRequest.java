package com.ripplechat.backend.channel.membership.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/** Body for adding another user to a channel (owner/moderator action). */
public record AddMemberRequest(
        @NotNull(message = "userId is required")
        UUID userId
) {
}
