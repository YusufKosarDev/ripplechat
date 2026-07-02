package com.ripplechat.backend.notification;

import com.ripplechat.backend.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * An activity-feed entry for a user: someone mentioned them, replied to their
 * message, or reacted to it. The {@code channelId}/{@code messageId} let the
 * client jump straight to the message.
 */
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

    public static final String TYPE_MENTION = "MENTION";
    public static final String TYPE_REPLY = "REPLY";
    public static final String TYPE_REACTION = "REACTION";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Who receives the notification. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    /** Who triggered it. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(name = "channel_id", nullable = false)
    private UUID channelId;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    /** A short snippet for display (message excerpt, or the reaction emoji). */
    @Column(length = 200)
    private String preview;

    @ColumnDefault("false")
    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
