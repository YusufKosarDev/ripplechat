package com.ripplechat.backend.message;

import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.message.dto.ReactionSummary;
import com.ripplechat.backend.message.dto.ThreadSummary;
import com.ripplechat.backend.redis.RedisBroadcastService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Publishes an updated message to its channel's update topic, so open clients
 * re-render it in place (an edit, a pin, a soft delete).
 *
 * <p>Edits, pins, deletes and the expiry sweep all reach this from different
 * classes. One implementation means those paths cannot drift into broadcasting
 * subtly different payloads for what a client sees as the same event.
 */
@Service
@RequiredArgsConstructor
public class MessageBroadcastService {

    private final MessageReactionService messageReactionService;
    private final MessageThreadSummaryService threadSummaryService;
    private final RedisBroadcastService redisBroadcastService;

    public void broadcastUpdate(Message message) {
        List<ReactionSummary> reactions = messageReactionService
                .summariesByMessage(List.of(message.getId()))
                .getOrDefault(message.getId(), List.of());
        ThreadSummary thread = message.getParent() == null
                ? threadSummaryService.summaryFor(message.getId())
                : ThreadSummary.empty();
        MessageResponse response = MessageResponse.from(message, reactions, thread);
        redisBroadcastService.broadcast(
                "/topic/channels/" + message.getChannel().getId() + "/message-updates", response);
    }
}
