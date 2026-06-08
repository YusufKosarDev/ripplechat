package com.ripplechat.backend.message.dto;

import java.util.List;

/**
 * Aggregated reactions for one emoji on a message. {@code users} lets each
 * client derive whether they themselves reacted.
 */
public record ReactionSummary(
        String emoji,
        int count,
        List<String> users
) {
}
