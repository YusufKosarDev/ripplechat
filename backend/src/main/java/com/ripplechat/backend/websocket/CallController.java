package com.ripplechat.backend.websocket;

import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
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

    public CallController(RedisBroadcastService redisBroadcastService,
                          ChannelMembershipRepository membershipRepository) {
        this.redisBroadcastService = redisBroadcastService;
        this.membershipRepository = membershipRepository;
    }

    /**
     * WebRTC signaling endpoint. Clients send OFFER/ANSWER/ICE_CANDIDATE to
     * /app/channels/{channelId}/call, and the server broadcasts it to the channel topic.
     */
    @MessageMapping("/channels/{channelId}/call")
    public void signal(@DestinationVariable UUID channelId,
                       @Payload CallSignal payload,
                       Principal principal) {
        if (principal == null || !membershipRepository.existsByChannelIdAndUser_Username(channelId, principal.getName())) {
            throw new MessagingException("not authorized to call in this channel: " + channelId);
        }

        // Ensure the senderId is authenticated as the current user
        CallSignal signalToBroadcast = new CallSignal(
                payload.type(),
                principal.getName(),
                payload.receiverId(),
                payload.payload()
        );
        redisBroadcastService.broadcast("/topic/channels/" + channelId + "/calls", signalToBroadcast);
    }
}
