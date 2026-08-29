package com.ripplechat.backend.bookmark;

import com.ripplechat.backend.bookmark.dto.SavedMessageResponse;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Bookmarks (saves) messages for a user and serves their saved-items list. */
@Service
@RequiredArgsConstructor
public class SavedMessageService {

    // Bookmarks are few in practice; cap the list rather than paginate.
    private static final int MAX_SAVED = 200;

    private final SavedMessageRepository repository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipService membershipService;

    @Transactional
    public void save(String username, UUID messageId) {
        User user = resolve(username);
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + messageId));
        // You can only bookmark a message in a channel you can see.
        if (!membershipService.isMember(message.getChannel().getId(), username)) {
            throw new ForbiddenException("not a member of the message's channel");
        }
        if (repository.existsByMessageIdAndUserId(messageId, user.getId())) {
            return; // idempotent
        }
        SavedMessage saved = new SavedMessage();
        saved.setMessageId(messageId);
        saved.setUserId(user.getId());
        repository.save(saved);
    }

    @Transactional
    public void unsave(String username, UUID messageId) {
        repository.deleteByMessageIdAndUserId(messageId, resolve(username).getId());
    }

    /**
     * The caller's bookmarks.
     *
     * <p>Membership is re-checked per channel, not just at the moment of saving:
     * otherwise leaving a channel — or being removed from one — left its
     * messages readable here indefinitely, which is a way around the very check
     * {@link #save} performs. Channels are looked up once each, so a long list
     * of bookmarks in a handful of channels costs a handful of queries.
     */
    @Transactional(readOnly = true)
    public List<SavedMessageResponse> list(String username) {
        UUID userId = resolve(username).getId();
        List<SavedMessage> saved = repository.findByUserIdOrderBySavedAtDesc(userId, PageRequest.of(0, MAX_SAVED));
        if (saved.isEmpty()) {
            return List.of();
        }
        Map<UUID, Instant> savedAt = saved.stream()
                .collect(Collectors.toMap(SavedMessage::getMessageId, SavedMessage::getSavedAt, (a, b) -> a));
        Map<UUID, Message> byId = messageRepository.findForSearchByIds(savedAt.keySet()).stream()
                .collect(Collectors.toMap(Message::getId, Function.identity()));
        Map<UUID, Boolean> stillAMember = new HashMap<>();
        return saved.stream()
                .map(s -> byId.get(s.getMessageId()))
                .filter(Objects::nonNull)
                .filter(m -> !m.isDeleted())
                .filter(m -> stillAMember.computeIfAbsent(m.getChannel().getId(),
                        channelId -> membershipService.isMember(channelId, username)))
                .map(m -> SavedMessageResponse.from(m, savedAt.get(m.getId())))
                .toList();
    }

    /** The ids of messages the user has bookmarked, for rendering the toggle state. */
    @Transactional(readOnly = true)
    public List<UUID> savedIds(String username) {
        return repository.findByUserId(resolve(username).getId()).stream()
                .map(SavedMessage::getMessageId)
                .toList();
    }

    private User resolve(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
    }
}
