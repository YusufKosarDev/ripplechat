package com.ripplechat.backend.poll;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory poll. Votes are tracked per user (one vote each, changeable),
 * so option counts are always derived and consistent. Not persisted.
 */
public class Poll {

    public record Option(String id, String text) {
    }

    private final UUID id;
    private final UUID channelId;
    private final String question;
    private final List<Option> options;
    private final String createdBy;
    private final Instant createdAt;
    private final Map<String, String> votes = new ConcurrentHashMap<>(); // username -> optionId

    public Poll(UUID channelId, String question, List<Option> options, String createdBy) {
        this.id = UUID.randomUUID();
        this.channelId = channelId;
        this.question = question;
        this.options = options;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }

    /** Records (or changes) a user's vote. Ignores unknown option ids. */
    public void vote(String username, String optionId) {
        if (options.stream().anyMatch(o -> o.id().equals(optionId))) {
            votes.put(username, optionId);
        }
    }

    public int countFor(String optionId) {
        return (int) votes.values().stream().filter(optionId::equals).count();
    }

    public int totalVotes() {
        return votes.size();
    }

    public UUID getId() {
        return id;
    }

    public UUID getChannelId() {
        return channelId;
    }

    public String getQuestion() {
        return question;
    }

    public List<Option> getOptions() {
        return options;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
