package com.ripplechat.backend.read;

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

import java.time.Instant;
import java.util.UUID;

/**
 * How far a user has read in a channel/DM: messages created at or before
 * {@code lastReadAt} are considered read by that user. One row per (channel, user).
 */
@Entity
@Table(name = "channel_reads", uniqueConstraints =
        @UniqueConstraint(name = "uk_channel_read_user", columnNames = {"channel_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
public class ChannelRead {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "channel_id", nullable = false)
    private UUID channelId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "last_read_at", nullable = false)
    private Instant lastReadAt;
}
