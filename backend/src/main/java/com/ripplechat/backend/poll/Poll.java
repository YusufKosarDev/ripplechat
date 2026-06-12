package com.ripplechat.backend.poll;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A poll persisted to the database. Each user has at most one (changeable) vote,
 * so option counts are always derived from the {@code poll_votes} rows and stay
 * consistent. Polls survive restarts and are rehydrated per channel on load.
 */
@Entity
@Table(name = "polls", indexes =
        @Index(name = "idx_polls_channel_created", columnList = "channel_id, created_at"))
@Getter
@Setter
@NoArgsConstructor
public class Poll {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "channel_id", nullable = false)
    private UUID channelId;

    @Column(nullable = false, length = 300)
    private String question;

    /** Username of the poll's author (matches the WS principal name). */
    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "poll", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<PollOption> options = new ArrayList<>();

    @OneToMany(mappedBy = "poll", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PollVote> votes = new ArrayList<>();

    public Poll(UUID channelId, String question, String createdBy) {
        this.channelId = channelId;
        this.question = question;
        this.createdBy = createdBy;
    }

    public void addOption(String optionKey, String text, int position) {
        options.add(new PollOption(this, optionKey, text, position));
    }

    /** Records or changes a user's vote; ignores unknown option keys. */
    public void vote(String username, String optionKey) {
        boolean validOption = options.stream().anyMatch(o -> o.getOptionKey().equals(optionKey));
        if (!validOption) {
            return;
        }
        votes.stream()
                .filter(v -> v.getUsername().equals(username))
                .findFirst()
                .ifPresentOrElse(
                        existing -> existing.setOptionKey(optionKey),
                        () -> votes.add(new PollVote(this, username, optionKey)));
    }

    public int countFor(String optionKey) {
        return (int) votes.stream().filter(v -> optionKey.equals(v.getOptionKey())).count();
    }

    public int totalVotes() {
        return votes.size();
    }
}
