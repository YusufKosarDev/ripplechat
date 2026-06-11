package com.ripplechat.backend.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateMessageRequest(

        @NotBlank(message = "content is required")
        @Size(max = 4000, message = "content must be at most 4000 characters")
        String content,

        /** When set, this message is a thread reply to that message. */
        UUID parentMessageId
) {
}
