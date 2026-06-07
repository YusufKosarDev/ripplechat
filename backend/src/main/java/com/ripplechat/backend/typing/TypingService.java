package com.ripplechat.backend.typing;

import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.typing.dto.TypingEvent;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Relays transient typing signals to a channel's members. Nothing is persisted.
 */
@Service
@RequiredArgsConstructor
public class TypingService {

    private final ChannelMembershipService membershipService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public void relayTyping(UUID channelId, String username, boolean typing) {
        if (!membershipService.isMember(channelId, username)) {
            throw new ForbiddenException("not a member of channel: " + channelId);
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/typing",
                new TypingEvent(user.getId(), user.getUsername(), user.getDisplayName(), typing));
    }
}
