package com.ripplechat.backend.typing.dto;

/**
 * Inbound typing signal sent by a client. The sender identity is taken from the
 * authenticated STOMP session, not from this payload.
 */
public record TypingRequest(
        boolean typing
) {
}
