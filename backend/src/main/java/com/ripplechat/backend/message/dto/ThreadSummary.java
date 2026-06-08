package com.ripplechat.backend.message.dto;

import com.ripplechat.backend.user.dto.UserSummary;

import java.util.List;

/**
 * Thread summary shown on a top-level message in the main feed.
 */
public record ThreadSummary(
        int replyCount,
        List<UserSummary> lastRepliers
) {
    public static ThreadSummary empty() {
        return new ThreadSummary(0, List.of());
    }
}
