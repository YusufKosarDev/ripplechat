package com.ripplechat.backend.reaction.dto;

/**
 * Inbound live reaction. The sender identity comes from the authenticated STOMP
 * session, not this payload.
 */
public record ReactionRequest(
        String emoji
) {
}
