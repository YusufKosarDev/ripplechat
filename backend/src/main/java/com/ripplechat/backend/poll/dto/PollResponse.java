package com.ripplechat.backend.poll.dto;

import com.ripplechat.backend.poll.Poll;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PollResponse(
        UUID id,
        UUID channelId,
        String question,
        List<OptionResult> options,
        String createdBy,
        Instant createdAt,
        int totalVotes
) {
    public record OptionResult(String id, String text, int votes) {
    }

    public static PollResponse from(Poll poll) {
        List<OptionResult> results = poll.getOptions().stream()
                .map(o -> new OptionResult(o.id(), o.text(), poll.countFor(o.id())))
                .toList();
        return new PollResponse(
                poll.getId(),
                poll.getChannelId(),
                poll.getQuestion(),
                results,
                poll.getCreatedBy(),
                poll.getCreatedAt(),
                poll.totalVotes());
    }
}
