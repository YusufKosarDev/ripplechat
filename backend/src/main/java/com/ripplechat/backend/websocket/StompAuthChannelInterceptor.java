package com.ripplechat.backend.websocket;

import com.ripplechat.backend.auth.JwtService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Collections;

/**
 * Authenticates STOMP connections: on the CONNECT frame it requires a valid
 * "Authorization: Bearer &lt;jwt&gt;" header and binds the resolved user to the
 * session, so later SEND/SUBSCRIBE frames carry an authenticated principal.
 * Connections without a valid token are rejected.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String PREFIX = "Bearer ";

    private final JwtService jwtService;

    public StompAuthChannelInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
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

        return message;
    }
}
