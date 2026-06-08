package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.common.dto.PageResponse;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.message.dto.ReactionSummary;
import com.ripplechat.backend.message.dto.ThreadSummary;
import com.ripplechat.backend.message.dto.ThreadUpdate;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.dto.UserSummary;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private static final int MAX_LAST_REPLIERS = 3;

    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final MessageReactionService messageReactionService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Persists a message and broadcasts it. A top-level message goes to the main
     * channel feed; a thread reply goes to its thread topic and updates the
     * parent's thread summary.
     */
    @Transactional
    public MessageResponse send(UUID channelId, CreateMessageRequest request, String username) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + channelId));
        requireMember(channelId, username);

        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        Message message = new Message();
        message.setContent(request.content());
        message.setChannel(channel);
        message.setSender(sender);

        if (request.parentMessageId() != null) {
            Message parent = messageRepository.findById(request.parentMessageId())
                    .orElseThrow(() -> new ResourceNotFoundException("parent message not found"));
            if (!parent.getChannel().getId().equals(channelId) || parent.getParent() != null) {
                throw new ResourceNotFoundException("invalid parent message");
            }
            message.setParent(parent);
        }

        Message saved = messageRepository.saveAndFlush(message);
        MessageResponse response = MessageResponse.from(saved);

        if (saved.getParent() == null) {
            messagingTemplate.convertAndSend("/topic/channels/" + channelId, response);
        } else {
            UUID parentId = saved.getParent().getId();
            messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/thread/" + parentId, response);
            messagingTemplate.convertAndSend("/topic/channels/" + channelId + "/thread-updates",
                    new ThreadUpdate(parentId, threadSummary(parentId)));
        }
        return response;
    }

    @Transactional(readOnly = true)
    public PageResponse<MessageResponse> findByChannel(UUID channelId, String username, Pageable pageable) {
        if (!channelRepository.existsById(channelId)) {
            throw new ResourceNotFoundException("channel not found: " + channelId);
        }
        requireMember(channelId, username);

        var page = messageRepository.findByChannelIdAndParentIsNull(channelId, pageable);
        List<UUID> ids = page.getContent().stream().map(Message::getId).toList();
        Map<UUID, List<ReactionSummary>> reactions = messageReactionService.summariesByMessage(ids);
        Map<UUID, ThreadSummary> threads = threadSummariesByParent(ids);

        return PageResponse.from(page.map(m -> MessageResponse.from(
                m,
                reactions.getOrDefault(m.getId(), List.of()),
                threads.getOrDefault(m.getId(), ThreadSummary.empty()))));
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> listThread(UUID channelId, UUID parentMessageId, String username) {
        requireMember(channelId, username);
        Message parent = messageRepository.findById(parentMessageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + parentMessageId));
        if (!parent.getChannel().getId().equals(channelId)) {
            throw new ResourceNotFoundException("message not found in channel: " + parentMessageId);
        }

        List<Message> replies = messageRepository.findByParent_IdOrderByCreatedAtAsc(parentMessageId);
        Map<UUID, List<ReactionSummary>> reactions = messageReactionService.summariesByMessage(
                replies.stream().map(Message::getId).toList());
        return replies.stream()
                .map(m -> MessageResponse.from(m, reactions.getOrDefault(m.getId(), List.of()), ThreadSummary.empty()))
                .toList();
    }

    @Transactional
    public void editMessage(UUID channelId, UUID messageId, String username, String content) {
        Message message = requireOwnMessage(channelId, messageId, username);
        if (message.isDeleted() || content == null || content.isBlank()) {
            return;
        }
        message.setContent(content);
        message.setEditedAt(Instant.now());
        messageRepository.saveAndFlush(message);
        broadcastUpdate(message);
    }

    @Transactional
    public void deleteMessage(UUID channelId, UUID messageId, String username) {
        Message message = requireOwnMessage(channelId, messageId, username);
        if (message.isDeleted()) {
            return;
        }
        message.setDeleted(true);
        message.setContent("");
        messageRepository.saveAndFlush(message);
        messageReactionService.deleteAllForMessage(messageId);
        broadcastUpdate(message);
    }

    private Message requireOwnMessage(UUID channelId, UUID messageId, String username) {
        requireMember(channelId, username);
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + messageId));
        if (!message.getChannel().getId().equals(channelId)) {
            throw new ResourceNotFoundException("message not found in channel: " + messageId);
        }
        if (!message.getSender().getUsername().equals(username)) {
            throw new ForbiddenException("you can only modify your own messages");
        }
        return message;
    }

    private void broadcastUpdate(Message message) {
        List<ReactionSummary> reactions = messageReactionService
                .summariesByMessage(List.of(message.getId()))
                .getOrDefault(message.getId(), List.of());
        ThreadSummary thread = message.getParent() == null
                ? threadSummary(message.getId())
                : ThreadSummary.empty();
        MessageResponse response = MessageResponse.from(message, reactions, thread);
        messagingTemplate.convertAndSend(
                "/topic/channels/" + message.getChannel().getId() + "/message-updates", response);
    }

    private Map<UUID, ThreadSummary> threadSummariesByParent(List<UUID> parentIds) {
        if (parentIds.isEmpty()) {
            return Map.of();
        }
        return messageRepository.findByParent_IdInOrderByCreatedAtAsc(parentIds).stream()
                .collect(Collectors.groupingBy(r -> r.getParent().getId()))
                .entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> summarize(e.getValue())));
    }

    private ThreadSummary threadSummary(UUID parentId) {
        return summarize(messageRepository.findByParent_IdOrderByCreatedAtAsc(parentId));
    }

    /** Builds a summary: reply count + the last few distinct repliers (most recent first). */
    private ThreadSummary summarize(List<Message> replies) {
        Set<UUID> seen = new LinkedHashSet<>();
        List<UserSummary> lastRepliers = new ArrayList<>();
        for (int i = replies.size() - 1; i >= 0 && lastRepliers.size() < MAX_LAST_REPLIERS; i--) {
            User sender = replies.get(i).getSender();
            if (seen.add(sender.getId())) {
                lastRepliers.add(UserSummary.from(sender));
            }
        }
        return new ThreadSummary(replies.size(), lastRepliers);
    }

    private void requireMember(UUID channelId, String username) {
        if (!membershipRepository.existsByChannelIdAndUser_Username(channelId, username)) {
            throw new ForbiddenException("not a member of channel: " + channelId);
        }
    }
}
