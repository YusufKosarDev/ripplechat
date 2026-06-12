package com.ripplechat.backend.poll;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * A single user's vote on a {@link Poll}. The unique (poll, username) constraint
 * enforces one vote per user; changing a vote updates {@code optionKey} in place.
 */
@Entity
@Table(name = "poll_votes", uniqueConstraints =
        @UniqueConstraint(name = "uk_poll_vote_user", columnNames = {"poll_id", "username"}))
@Getter
@Setter
@NoArgsConstructor
public class PollVote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "poll_id", nullable = false)
    private Poll poll;

    @Column(nullable = false)
    private String username;

    @Column(name = "option_key", nullable = false)
    private String optionKey;

    public PollVote(Poll poll, String username, String optionKey) {
        this.poll = poll;
        this.username = username;
        this.optionKey = optionKey;
    }
}
