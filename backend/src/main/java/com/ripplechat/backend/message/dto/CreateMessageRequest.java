package com.ripplechat.backend.message.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateMessageRequest(

        @NotBlank(message = "content is required")
        String content
) {
}
