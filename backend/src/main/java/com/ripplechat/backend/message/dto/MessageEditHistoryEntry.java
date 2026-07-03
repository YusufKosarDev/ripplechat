package com.ripplechat.backend.message.dto;

import com.ripplechat.backend.message.MessageEditHistory;

import java.time.Instant;

/** One superseded version of a message, for the edit-history view. */
public record MessageEditHistoryEntry(String content, Instant editedAt) {
    public static MessageEditHistoryEntry from(MessageEditHistory history) {
        return new MessageEditHistoryEntry(history.getContent(), history.getEditedAt());
    }
}
