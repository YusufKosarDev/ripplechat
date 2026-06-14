package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.common.RateLimiter;
import com.ripplechat.backend.common.dto.PageResponse;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MediaItem;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.message.dto.ReactionSummary;
import com.ripplechat.backend.message.dto.ThreadSummary;
import com.ripplechat.backend.message.dto.ThreadUpdate;
import com.ripplechat.backend.push.MessageSentEvent;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.dto.UserSummary;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
    private static final int MAX_MESSAGE_LENGTH = 4000;
    // Attachment URLs must be ones we issued (Cloudinary uploads) or a GIF picked
    // from Giphy — never arbitrary client input.
    private static final String CLOUDINARY_PREFIX = "https://res.cloudinary.com/";
    // Send throttle: 10-message burst, then ~5/sec sustained per user.
    private static final double SEND_BURST = 10;
    private static final double SEND_REFILL_PER_SEC = 5;

    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final MessageReactionService messageReactionService;
    private final MessageHideRepository messageHideRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RateLimiter rateLimiter;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Persists a message and broadcasts it. A top-level message goes to the main
     * channel feed; a thread reply goes to its thread topic and updates the
     * parent's thread summary.
     */
    @Transactional
    public MessageResponse send(UUID channelId, CreateMessageRequest request, String username) {
        if (!rateLimiter.tryAcquire("msg:" + username, SEND_BURST, SEND_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "sending too fast, please slow down");
        }
        // Enforce content rules in the service so they apply to WebSocket sends too
        // (the @Valid on the REST DTO does not cover the STOMP @Payload path).
        String content = request.content() == null ? "" : request.content().trim();
        String attachmentUrl = request.attachmentUrl();
        boolean hasAttachment = attachmentUrl != null && !attachmentUrl.isBlank();
        if (content.isBlank() && !hasAttachment) {
            throw new BadRequestException("content or attachment is required");
        }
        if (content.length() > MAX_MESSAGE_LENGTH) {
            throw new BadRequestException("content must be at most " + MAX_MESSAGE_LENGTH + " characters");
        }
        if (hasAttachment && !isAllowedAttachmentUrl(attachmentUrl)) {
            throw new BadRequestException("invalid attachment url");
        }

        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + channelId));
        if (channel.isDeleted()) {
            throw new ResourceNotFoundException("channel not found: " + channelId);
        }
        requireMember(channelId, username);

        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        Message message = new Message();
        message.setContent(content);
        if (hasAttachment) {
            message.setAttachmentUrl(attachmentUrl);
            message.setAttachmentName(request.attachmentName());
            String type = request.attachmentType();
            message.setAttachmentType("file".equals(type) || "audio".equals(type) ? type : "image");
        }
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

        // Quoted reply: denormalize a small preview (sender + snippet) of the quoted
        // message. Ignored if the quote isn't a message in the same channel.
        if (request.quotedMessageId() != null) {
            messageRepository.findById(request.quotedMessageId())
                    .filter(q -> q.getChannel().getId().equals(channelId))
                    .ifPresent(q -> {
                        message.setQuotedMessageId(q.getId());
                        String quotedSenderName = q.getSender().getDisplayName() != null
                                ? q.getSender().getDisplayName() : q.getSender().getUsername();
                        message.setQuotedSender(quotedSenderName);
                        String preview = q.isDeleted() || q.getContent() == null ? "" : q.getContent();
                        if (preview.isBlank() && q.getAttachmentUrl() != null) {
                            preview = "📷 Görsel";
                        }
                        message.setQuotedContent(preview.length() > 140 ? preview.substring(0, 140) : preview);
                    });
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
        eventPublisher.publishEvent(new MessageSentEvent(channelId, saved.getId(), username));
        return response;
    }

    /**
     * Forwards an existing message into another channel. The content/attachment
     * are copied server-side from the source (which the user must be able to see),
     * marked as forwarded, and broadcast like a normal top-level message.
     */
    @Transactional
    public MessageResponse forward(UUID targetChannelId, UUID sourceMessageId, String username) {
        if (!rateLimiter.tryAcquire("msg:" + username, SEND_BURST, SEND_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "sending too fast, please slow down");
        }
        Channel target = channelRepository.findById(targetChannelId)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + targetChannelId));
        if (target.isDeleted()) {
            throw new ResourceNotFoundException("channel not found: " + targetChannelId);
        }
        requireMember(targetChannelId, username);

        Message source = messageRepository.findById(sourceMessageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + sourceMessageId));
        // You can only forward a message from a channel you're a member of.
        requireMember(source.getChannel().getId(), username);
        if (source.isDeleted()) {
            throw new BadRequestException("cannot forward a deleted message");
        }

        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        Message message = new Message();
        message.setContent(source.getContent() == null ? "" : source.getContent());
        message.setAttachmentUrl(source.getAttachmentUrl());
        message.setForwarded(true);
        message.setChannel(target);
        message.setSender(sender);
        Message saved = messageRepository.saveAndFlush(message);

        MessageResponse response = MessageResponse.from(saved);
        messagingTemplate.convertAndSend("/topic/channels/" + targetChannelId, response);
        return response;
    }

    @Transactional(readOnly = true)
    public PageResponse<MessageResponse> findByChannel(UUID channelId, String username, Pageable pageable) {
        if (!channelRepository.existsById(channelId)) {
            throw new ResourceNotFoundException("channel not found: " + channelId);
        }
        requireMember(channelId, username);

        User viewer = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        var page = messageRepository.findChannelFeed(channelId, viewer.getId(), pageable);
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
        if (message.isDeleted() || content == null || content.isBlank() || content.length() > MAX_MESSAGE_LENGTH) {
            return;
        }
        message.setContent(content);
        message.setEditedAt(Instant.now());
        messageRepository.saveAndFlush(message);
        broadcastUpdate(message);
    }

    @Transactional
    public void deleteMessage(UUID channelId, UUID messageId, String username) {
        requireMember(channelId, username);
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + messageId));
        if (!message.getChannel().getId().equals(channelId)) {
            throw new ResourceNotFoundException("message not found in channel: " + messageId);
        }
        // Owner of the message OR a channel moderator/owner may delete it.
        boolean isSender = message.getSender().getUsername().equals(username);
        if (!isSender) {
            MembershipRole role = membershipRepository.findByChannelIdAndUser_Username(channelId, username)
                    .map(ChannelMembership::getRole)
                    .orElse(null);
            if (role == null || !role.canModerate()) {
                throw new ForbiddenException("you can only delete your own messages");
            }
        }
        if (message.isDeleted()) {
            return;
        }
        message.setDeleted(true);
        message.setContent("");
        message.setAttachmentUrl(null);
        message.setAttachmentName(null);
        message.setAttachmentType(null);
        messageRepository.saveAndFlush(message);
        messageReactionService.deleteAllForMessage(messageId);
        broadcastUpdate(message);
    }

    @Transactional
    public void pin(UUID channelId, UUID messageId, String username) {
        setPinned(channelId, messageId, username, true);
    }

    @Transactional
    public void unpin(UUID channelId, UUID messageId, String username) {
        setPinned(channelId, messageId, username, false);
    }

    private void setPinned(UUID channelId, UUID messageId, String username, boolean pinned) {
        requireMember(channelId, username);
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + messageId));
        if (!message.getChannel().getId().equals(channelId)) {
            throw new ResourceNotFoundException("message not found in channel: " + messageId);
        }
        if (message.isPinned() == pinned) {
            return;
        }
        message.setPinned(pinned);
        messageRepository.saveAndFlush(message);
        broadcastUpdate(message);
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> listPinned(UUID channelId, String username) {
        requireMember(channelId, username);
        return messageRepository.findByChannelIdAndPinnedTrueAndDeletedFalseOrderByCreatedAtDesc(channelId).stream()
                .map(MessageResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MediaItem> listMedia(UUID channelId, String username) {
        requireMember(channelId, username);
        return messageRepository.findByChannelIdAndAttachmentUrlIsNotNullAndDeletedFalseOrderByCreatedAtDesc(channelId)
                .stream()
                .filter(m -> m.getAttachmentType() == null || "image".equals(m.getAttachmentType())) // images only
                .map(MediaItem::from)
                .toList();
    }

    /** "Delete for me": hides the message from this user's feed only. */
    @Transactional
    public void hideForMe(UUID channelId, UUID messageId, String username) {
        requireMember(channelId, username);
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + messageId));
        if (!message.getChannel().getId().equals(channelId)) {
            throw new ResourceNotFoundException("message not found in channel: " + messageId);
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        if (!messageHideRepository.existsByMessageIdAndUserId(messageId, user.getId())) {
            MessageHide hide = new MessageHide();
            hide.setMessageId(messageId);
            hide.setUserId(user.getId());
            messageHideRepository.save(hide);
        }
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

    /** Allows our own Cloudinary uploads and GIFs picked from Giphy. */
    private boolean isAllowedAttachmentUrl(String url) {
        if (url.startsWith(CLOUDINARY_PREFIX)) {
            return true;
        }
        try {
            String host = java.net.URI.create(url).getHost();
            return host != null && (host.equals("giphy.com") || host.endsWith(".giphy.com"));
        } catch (Exception e) {
            return false;
        }
    }
}
