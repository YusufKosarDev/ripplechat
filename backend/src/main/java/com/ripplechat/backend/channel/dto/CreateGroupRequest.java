package com.ripplechat.backend.channel.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** Body for creating a group DM: the other members and an optional title. */
public record CreateGroupRequest(
        // Bounded: the list is resolved with findAllById, so an unbounded one is
        // an arbitrarily large query from a single request.
        @NotEmpty
        @Size(max = 50, message = "a group can have at most 50 other members")
        List<UUID> userIds,
        String name
) {
}
