package com.ripplechat.backend.notification;

import com.ripplechat.backend.common.dto.PageResponse;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.notification.dto.NotificationResponse;
import com.ripplechat.backend.redis.RedisBroadcastService;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Creates and serves activity-feed notifications. Each new notification is also
 * pushed live to the recipient over their personal STOMP topic
 * ({@code /topic/users/{username}/notifications}), which only they may subscribe to.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int PREVIEW_MAX = 200;

    private final NotificationRepository repository;
    private final UserRepository userRepository;
    private final RedisBroadcastService broadcast;

    /**
     * Records a notification and pushes it live. No-op when the actor is the
     * recipient (you never notify yourself) or the recipient is a deleted account.
     */
    @Transactional
    public void notify(User recipient, User actor, String type, UUID channelId, UUID messageId, String preview) {
        if (recipient == null || actor == null
                || recipient.getId().equals(actor.getId())
                || recipient.isDeleted()) {
            return;
        }
        Notification n = new Notification();
        n.setRecipient(recipient);
        n.setActor(actor);
        n.setType(type);
        n.setChannelId(channelId);
        n.setMessageId(messageId);
        n.setPreview(truncate(preview));
        Notification saved = repository.save(n);

        broadcast.broadcast("/topic/users/" + recipient.getUsername() + "/notifications",
                NotificationResponse.from(saved));
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> list(String username, Pageable pageable) {
        UUID userId = resolve(username).getId();
        return PageResponse.from(
                repository.findByRecipient_IdOrderByCreatedAtDesc(userId, pageable)
                        .map(NotificationResponse::from));
    }

    @Transactional(readOnly = true)
    public long unreadCount(String username) {
        return repository.countByRecipient_IdAndReadFalse(resolve(username).getId());
    }

    @Transactional
    public void markRead(String username, UUID id) {
        UUID userId = resolve(username).getId();
        repository.findById(id)
                .filter(n -> n.getRecipient().getId().equals(userId))
                .ifPresent(n -> n.setRead(true));
    }

    @Transactional
    public void markAllRead(String username) {
        repository.markAllRead(resolve(username).getId());
    }

    private User resolve(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
    }

    private static String truncate(String s) {
        if (s == null) {
            return null;
        }
        String trimmed = s.strip();
        return trimmed.length() > PREVIEW_MAX ? trimmed.substring(0, PREVIEW_MAX) : trimmed;
    }
}
