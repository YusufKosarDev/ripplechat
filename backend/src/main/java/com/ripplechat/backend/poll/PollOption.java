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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * One choice in a {@link Poll}. {@code optionKey} is the stable client-facing
 * id (the option's index as a string); {@code position} preserves order.
 */
@Entity
@Table(name = "poll_options")
@Getter
@Setter
@NoArgsConstructor
public class PollOption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "poll_id", nullable = false)
    private Poll poll;

    @Column(name = "option_key", nullable = false)
    private String optionKey;

    @Column(nullable = false, length = 100)
    private String text;

    @Column(nullable = false)
    private int position;

    public PollOption(Poll poll, String optionKey, String text, int position) {
        this.poll = poll;
        this.optionKey = optionKey;
        this.text = text;
        this.position = position;
    }
}
