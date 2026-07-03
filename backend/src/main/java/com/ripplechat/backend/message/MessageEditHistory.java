package com.ripplechat.backend.message;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * A superseded version of a message's content. One row is written each time a
 * message is edited, capturing the content that was replaced.
 */
@Entity
@Table(name = "message_edit_history", indexes = {
        @Index(name = "idx_message_edit_history_message", columnList = "message_id, edited_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
public class MessageEditHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "message_id", nullable = false, updatable = false)
    private Message message;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** When this content stopped being current (i.e. when the edit that replaced it happened). */
    @Column(name = "edited_at", nullable = false)
    private Instant editedAt;

    public MessageEditHistory(Message message, String content, Instant editedAt) {
        this.message = message;
        this.content = content;
        this.editedAt = editedAt;
    }
}
