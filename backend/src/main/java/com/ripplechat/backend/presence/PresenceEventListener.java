package com.ripplechat.backend.presence;

import com.ripplechat.backend.presence.dto.PresenceEvent;
import com.ripplechat.backend.user.UserRepository;
import org.springframework.context.event.EventListener;
import com.ripplechat.backend.redis.RedisBroadcastService;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;

/**
 * Reacts to STOMP session lifecycle events to maintain presence and broadcast
 * online/offline transitions to /topic/presence.
 */
@Component
public class PresenceEventListener {

    private static final String PRESENCE_TOPIC = "/topic/presence";

    private final PresenceService presenceService;
    private final RedisBroadcastService redisBroadcastService;
    private final UserRepository userRepository;

    public PresenceEventListener(PresenceService presenceService,
                                 RedisBroadcastService redisBroadcastService,
                                 UserRepository userRepository) {
        this.presenceService = presenceService;
        this.redisBroadcastService = redisBroadcastService;
        this.userRepository = userRepository;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        String username = usernameOf(event.getUser());
        String sessionId = (String) event.getMessage().getHeaders().get(SimpMessageHeaderAccessor.SESSION_ID_HEADER);
        if (username != null && sessionId != null && presenceService.connected(username, sessionId)) {
            broadcast(username, PresenceStatus.ONLINE);
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        String username = usernameOf(event.getUser());
        if (username != null && event.getSessionId() != null && presenceService.disconnected(username, event.getSessionId())) {
            broadcast(username, PresenceStatus.OFFLINE);
        }
    }

    private String usernameOf(Principal principal) {
        return principal != null ? principal.getName() : null;
    }

    private void broadcast(String username, PresenceStatus status) {
        userRepository.findByUsername(username).ifPresent(user -> {
            if (status == PresenceStatus.OFFLINE) {
                user.setLastSeenAt(Instant.now());
                userRepository.save(user);
            }
            redisBroadcastService.broadcast(PRESENCE_TOPIC,
                    new PresenceEvent(user.getId(), user.getUsername(), user.getDisplayName(), status));
        });
    }
}
