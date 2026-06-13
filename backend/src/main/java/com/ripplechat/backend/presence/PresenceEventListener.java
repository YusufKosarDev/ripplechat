package com.ripplechat.backend.presence;

import com.ripplechat.backend.presence.dto.PresenceEvent;
import com.ripplechat.backend.user.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
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
    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;

    public PresenceEventListener(PresenceService presenceService,
                                 SimpMessagingTemplate messagingTemplate,
                                 UserRepository userRepository) {
        this.presenceService = presenceService;
        this.messagingTemplate = messagingTemplate;
        this.userRepository = userRepository;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        String username = usernameOf(event.getUser());
        if (username != null && presenceService.connected(username)) {
            broadcast(username, PresenceStatus.ONLINE);
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        String username = usernameOf(event.getUser());
        if (username != null && presenceService.disconnected(username)) {
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
            messagingTemplate.convertAndSend(PRESENCE_TOPIC,
                    new PresenceEvent(user.getId(), user.getUsername(), user.getDisplayName(), status));
        });
    }
}
