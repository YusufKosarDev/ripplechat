package com.ripplechat.backend.poll;

import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory store of active polls. Cleared on restart (polls are ephemeral).
 */
@Component
public class PollStore {

    private final Map<UUID, Poll> pollsById = new ConcurrentHashMap<>();

    public void save(Poll poll) {
        pollsById.put(poll.getId(), poll);
    }

    public Poll get(UUID pollId) {
        return pollsById.get(pollId);
    }

    public List<Poll> byChannel(UUID channelId) {
        return pollsById.values().stream()
                .filter(p -> p.getChannelId().equals(channelId))
                .sorted(Comparator.comparing(Poll::getCreatedAt))
                .toList();
    }
}
