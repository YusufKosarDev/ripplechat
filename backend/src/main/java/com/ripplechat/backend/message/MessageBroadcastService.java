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
 * <p>Shared rather than duplicated: this is called from both
 * {@link MessageService} (edits) and {@link MessageModerationService} (pin,
 * delete, expiry sweep). Keeping one copy is what stops those paths from
 * drifting into broadcasting subtly different payloads for the same event.
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
