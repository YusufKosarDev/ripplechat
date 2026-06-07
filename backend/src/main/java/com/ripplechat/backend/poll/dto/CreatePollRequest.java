package com.ripplechat.backend.poll.dto;

import java.util.List;

public record CreatePollRequest(
        String question,
        List<String> options
) {
}
