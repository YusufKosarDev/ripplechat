package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.user.User;
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
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "messages", indexes = {
        // Main channel feed: where channel_id = ? and parent_message_id is null
        // order by created_at (findByChannelIdAndParentIsNull) + channel scoping
        // for search. Postgres does not auto-index FK columns.
        @Index(name = "idx_messages_channel_parent_created",
                columnList = "channel_id, parent_message_id, created_at"),
        // Thread replies: where parent_message_id = ?/in (?) order by created_at.
        @Index(name = "idx_messages_parent_created",
                columnList = "parent_message_id, created_at")
})
@Getter
@Setter
@NoArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false, updatable = false)
    private Channel channel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false, updatable = false)
    private User sender;

    /**
     * The message this is a thread reply to. Null for top-level channel messages.
     * Threads are one level deep (a reply cannot itself have replies).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_message_id", updatable = false)
    private Message parent;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Set when the message has been edited; null otherwise. */
    @Column(name = "edited_at")
    private Instant editedAt;

    /** URL of an optional image attachment (Cloudinary); null for text-only messages. */
    @Column(name = "attachment_url", length = 1024)
    private String attachmentUrl;

    /** Quoted message reference + denormalized preview (sender + snippet), or null. */
    @Column(name = "quoted_message_id")
    private UUID quotedMessageId;

    @Column(name = "quoted_sender")
    private String quotedSender;

    @Column(name = "quoted_content", columnDefinition = "text")
    private String quotedContent;

    /** True when this message was created by forwarding another message. */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean forwarded = false;

    /** Pinned to the channel (highlighted in a pinned list). */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean pinned = false;

    /** Soft delete: the row stays (threads/reactions intact) but content is cleared. */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean deleted = false;
}
