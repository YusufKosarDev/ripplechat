package com.ripplechat.backend.reaction;

import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.RateLimiter;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.reaction.dto.ReactionEvent;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Relays transient "flying" emoji reactions to a channel's members.
 * Nothing is persisted.
 */
@Service
@RequiredArgsConstructor
public class ReactionService {

    private static final int MAX_EMOJI_LENGTH = 16;
    // Flying-emoji throttle: 15 burst, ~8/sec sustained per user.
    private static final double REACT_BURST = 15;
    private static final double REACT_REFILL_PER_SEC = 8;

    private final ChannelMembershipService membershipService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RateLimiter rateLimiter;

    public void relayReaction(UUID channelId, String username, String emoji) {
        if (emoji == null || emoji.isBlank() || emoji.length() > MAX_EMOJI_LENGTH) {
            return; // ignore empty or oversized payloads
        }
        if (!rateLimiter.tryAcquire("react:" + username, REACT_BURST, REACT_REFILL_PER_SEC)) {
            return; // drop excess flying-emoji spam silently (transient effect)
        }
        if (!membershipService.isMember(channelId, username)) {
            throw new ForbiddenException("not a member of channel: " + channelId);
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/reactions",
                new ReactionEvent(user.getId(), user.getUsername(), emoji));
    }
}
