package com.ripplechat.backend.websocket;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import com.ripplechat.backend.websocket.dto.CallSignal;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import com.ripplechat.backend.redis.RedisBroadcastService;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

@Controller
public class CallController {

    private final RedisBroadcastService redisBroadcastService;
    private final ChannelMembershipRepository membershipRepository;
    private final UserRepository userRepository;

    public CallController(RedisBroadcastService redisBroadcastService,
                          ChannelMembershipRepository membershipRepository,
                          UserRepository userRepository) {
        this.redisBroadcastService = redisBroadcastService;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
    }

    /**
     * WebRTC signaling endpoint.
     *
     * <p>A signal addressed to one peer ({@code receiverId} set — offers,
     * answers, ICE candidates) goes to that user's personal topic, which only
     * they may subscribe to. It used to go to the channel topic like everything
     * else, so in a group channel every member's browser received the session
     * description and candidates for a call between two other people — and,
     * because the client never filtered on receiverId, acted on them: several
     * peers answering the same offer. Only the un-addressed signals that are
     * genuinely for the room (ringing, hang-up) stay on the channel topic.
     */
    @MessageMapping("/channels/{channelId}/call")
    public void signal(@DestinationVariable UUID channelId,
                       @Payload CallSignal payload,
                       Principal principal) {
        if (principal == null || !membershipRepository.existsByChannelIdAndUser_Username(channelId, principal.getName())) {
            throw new MessagingException("not authorized to call in this channel: " + channelId);
        }

        // The sender is the authenticated principal, never whoever the body
        // claims. It is sent as the user id because that is what the client
        // compares against: its own id, and the ids on its block list. A
        // username here silently disabled both.
        String senderId = userRepository.findByUsername(principal.getName())
                .map(user -> user.getId().toString())
                .orElseThrow(() -> new MessagingException("unknown caller"));
        CallSignal signalToBroadcast = new CallSignal(
                payload.type(),
                channelId.toString(),
                senderId,
                payload.receiverId(),
                payload.payload()
        );

        String recipient = recipientUsername(channelId, payload.receiverId());
        if (recipient != null) {
            redisBroadcastService.broadcast("/topic/users/" + recipient + "/calls", signalToBroadcast);
        } else if (payload.receiverId() == null) {
            redisBroadcastService.broadcast("/topic/channels/" + channelId + "/calls", signalToBroadcast);
        }
        // An addressed signal whose recipient is unknown or not in the channel is
        // dropped: broadcasting it to the room is what this is here to stop.
    }

    /** The addressed peer's username, if they are a member of this channel. */
    private String recipientUsername(UUID channelId, String receiverId) {
        if (receiverId == null || receiverId.isBlank()) {
            return null;
        }
        UUID id;
        try {
            id = UUID.fromString(receiverId);
        } catch (IllegalArgumentException e) {
            return null;
        }
        return userRepository.findById(id)
                .map(User::getUsername)
                .filter(username -> membershipRepository.existsByChannelIdAndUser_Username(channelId, username))
                .orElse(null);
    }
}
