package com.ripplechat.backend.admin.dto;

/** Headline counts for the admin dashboard. */
public record AdminOverview(
        long totalUsers,
        long admins,
        long disabledUsers,
        long bots,
        long totalChannels,
        long totalMessages
) {
}
