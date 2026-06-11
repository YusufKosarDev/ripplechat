package com.ripplechat.backend.message.dto;

import jakarta.validation.constraints.Size;

public record EditMessageRequest(
        @Size(max = 4000, message = "content must be at most 4000 characters")
        String content
) {
}
