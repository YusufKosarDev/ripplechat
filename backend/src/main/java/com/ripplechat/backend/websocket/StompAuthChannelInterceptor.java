package com.ripplechat.backend.websocket;

import com.ripplechat.backend.auth.JwtService;
import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Collections;
import java.util.UUID;

/**
 * STOMP authentication + per-channel subscription authorization.
 *
 * <p>On CONNECT a valid "Authorization: Bearer &lt;jwt&gt;" header is required and
 * the resolved user is bound to the session.
 *
 * <p>On SUBSCRIBE to a channel topic (/topic/channels/{id}...), a subscriber to a
 * <em>private</em> channel must be a member — otherwise the frame is rejected.
 * This stops a non-member (or a removed member who still knows the id) from
 * eavesdropping on a private channel's live messages, typing, reactions, polls
 * and updates. Public channels stay discoverable, and non-channel topics (e.g.
 * /topic/presence) are unaffected.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String PREFIX = "Bearer ";
    private static final String CHANNEL_TOPIC_PREFIX = "/topic/channels/";

    private final JwtService jwtService;
    private final ChannelRepository channelRepository;
    private final ChannelMembershipRepository membershipRepository;

    public StompAuthChannelInterceptor(JwtService jwtService,
                                       ChannelRepository channelRepository,
                                       ChannelMembershipRepository membershipRepository) {
        this.jwtService = jwtService;
        this.channelRepository = channelRepository;
        this.membershipRepository = membershipRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticateConnect(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            authorizeSubscribe(accessor);
        }

        return message;
    }

    private void authenticateConnect(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");
        if (header == null || !header.startsWith(PREFIX)) {
            throw new MessagingException("Missing or invalid Authorization header");
        }
        String username;
        try {
            username = jwtService.extractUsername(header.substring(PREFIX.length()));
        } catch (Exception ex) {
            throw new MessagingException("Invalid token");
        }
        var authentication = new UsernamePasswordAuthenticationToken(
                username, null, Collections.emptyList());
        accessor.setUser(authentication);
    }

    private void authorizeSubscribe(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith(CHANNEL_TOPIC_PREFIX)) {
            return; // not a channel topic (e.g. /topic/presence) — no per-channel check
        }

        UUID channelId = parseChannelId(destination);
        if (channelId == null) {
            return; // unrecognized shape; nothing channel-scoped to protect
        }

        Channel target = channelRepository.findById(channelId).orElse(null);
        if (target == null || !target.isPrivate()) {
            return; // public or non-existent channel: subscription allowed
        }

        Principal user = accessor.getUser();
        String username = user != null ? user.getName() : null;
        if (username == null
                || !membershipRepository.existsByChannelIdAndUser_Username(channelId, username)) {
            throw new MessagingException("not authorized to subscribe to channel: " + channelId);
        }
    }

    /** Extracts the {id} from /topic/channels/{id} or /topic/channels/{id}/... */
    private UUID parseChannelId(String destination) {
        String rest = destination.substring(CHANNEL_TOPIC_PREFIX.length());
        int slash = rest.indexOf('/');
        String idPart = slash >= 0 ? rest.substring(0, slash) : rest;
        try {
            return UUID.fromString(idPart);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
