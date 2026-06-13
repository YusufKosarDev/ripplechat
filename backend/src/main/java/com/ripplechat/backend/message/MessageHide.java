package com.ripplechat.backend.message;

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

import java.util.UUID;

/**
 * "Delete for me": a message hidden from one user's view only. The message row
 * is untouched; it is just filtered out of that user's channel feed.
 */
@Entity
@Table(name = "message_hides", uniqueConstraints =
        @UniqueConstraint(name = "uk_message_hide_user", columnNames = {"message_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
public class MessageHide {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;
}
