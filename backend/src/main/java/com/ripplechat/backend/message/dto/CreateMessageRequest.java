package com.ripplechat.backend.message.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record CreateMessageRequest(

        @NotBlank(message = "content is required")
        String content,

        /** When set, this message is a thread reply to that message. */
        UUID parentMessageId
) {
}
