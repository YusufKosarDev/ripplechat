package com.ripplechat.backend.e2ee;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "group_sender_keys", uniqueConstraints =
        @UniqueConstraint(name = "uk_group_sender_key", columnNames = {"channel_id", "sender_id", "recipient_id"}))
@Getter
@Setter
@NoArgsConstructor
public class GroupSenderKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "channel_id", nullable = false)
    private UUID channelId;

    @Column(name = "sender_id", nullable = false)
    private UUID senderId;

    @Column(name = "recipient_id", nullable = false)
    private UUID recipientId;

    @Column(name = "encrypted_key", nullable = false, columnDefinition = "TEXT")
    private String encryptedKey;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
}
