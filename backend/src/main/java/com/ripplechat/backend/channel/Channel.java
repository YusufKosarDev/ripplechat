package com.ripplechat.backend.channel;

import com.ripplechat.backend.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

@Entity
@Table(name = "channels")
@Getter
@Setter
@NoArgsConstructor
public class Channel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column
    private String description;

    @Column(name = "is_private", nullable = false)
    private boolean isPrivate = false;

    /** Regular channel vs. one-to-one direct message. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ColumnDefault("'CHANNEL'")
    private ChannelType type = ChannelType.CHANNEL;

    /**
     * For DIRECT channels: a stable "minUserId:maxUserId" key so a pair of users
     * has exactly one DM (unique). Null for regular channels.
     */
    @Column(name = "dm_key", unique = true)
    private String dmKey;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false, updatable = false)
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Soft delete: archived channels are hidden from listings. */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean deleted = false;

    /**
     * Disappearing-messages timer in seconds. When set (and &gt; 0), each new
     * message gets an expires_at = now + this, after which it is auto-deleted.
     * Null means the feature is off for this channel.
     */
    @Column(name = "message_ttl_seconds")
    private Integer messageTtlSeconds;
}
