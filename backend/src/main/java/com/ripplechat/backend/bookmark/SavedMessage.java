package com.ripplechat.backend.bookmark;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * A user's bookmark of a message. Per-user (like {@code MessageHide}); the
 * message row is untouched. Stored as plain ids so a message can be bookmarked
 * without a hard reference that would complicate its lifecycle.
 */
@Entity
@Table(name = "saved_messages", uniqueConstraints =
        @UniqueConstraint(name = "uk_saved_message_user", columnNames = {"message_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
public class SavedMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @CreationTimestamp
    @Column(name = "saved_at", nullable = false, updatable = false)
    private Instant savedAt;
}
