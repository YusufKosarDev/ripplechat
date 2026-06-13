package com.ripplechat.backend.message.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/** Body for forwarding an existing message into another channel. */
public record ForwardRequest(
        @NotNull UUID sourceMessageId
) {
}
