package com.ripplechat.backend.message.scheduled;

import com.ripplechat.backend.channel.Channel;
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
 * A message a user has queued to be sent to a channel at {@link #scheduledAt}.
 * The {@code ScheduledMessageDispatcher} delivers due rows and flips {@link #sent}.
 */
@Entity
@Table(name = "scheduled_messages")
@Getter
@Setter
@NoArgsConstructor
public class ScheduledMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false)
    private Channel channel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(columnDefinition = "text", nullable = false)
    private String content;

    @Column(name = "scheduled_at", nullable = false)
    private Instant scheduledAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean sent = false;

    /**
     * Delivery attempts made so far. A message whose delivery cannot succeed —
     * the author has left the channel since scheduling it, say — would otherwise
     * be retried on every sweep for ever.
     */
    @Column(nullable = false)
    @ColumnDefault("0")
    private int attempts = 0;

    /** Why the last attempt failed, kept so an abandoned row explains itself. */
    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;
}
