package com.ripplechat.backend.channel.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

/** Body for creating a group DM: the other members and an optional title. */
public record CreateGroupRequest(
        @NotEmpty List<UUID> userIds,
        String name
) {
}
