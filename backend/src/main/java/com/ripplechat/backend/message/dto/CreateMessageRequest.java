package com.ripplechat.backend.message.dto;

import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateMessageRequest(

        // Content is optional when an attachment is present; the service enforces
        // "content or attachment required" (also covers the WebSocket payload path).
        @Size(max = 4000, message = "content must be at most 4000 characters")
        String content,

        /** When set, this message is a thread reply to that message. */
        UUID parentMessageId,

        /** Optional attachment URL (returned by POST /api/uploads/image or /file). */
        @Size(max = 1024)
        String attachmentUrl,

        /** When set, this message quotes that message (inline preview). */
        UUID quotedMessageId,

        /** Original filename of a file attachment (shown on the download card). */
        @Size(max = 255)
        String attachmentName,

        /** Attachment kind: "image" (inline) or "file" (download card). */
        @Size(max = 16)
        String attachmentType
) {
    /** Plain text / thread message, no attachment or quote. */
    public CreateMessageRequest(String content, UUID parentMessageId) {
        this(content, parentMessageId, null, null, null, null);
    }

    /** Message with an attachment but no quote. */
    public CreateMessageRequest(String content, UUID parentMessageId, String attachmentUrl) {
        this(content, parentMessageId, attachmentUrl, null, null, null);
    }

    /** Message with an attachment and a quote. */
    public CreateMessageRequest(String content, UUID parentMessageId, String attachmentUrl, UUID quotedMessageId) {
        this(content, parentMessageId, attachmentUrl, quotedMessageId, null, null);
    }
}
