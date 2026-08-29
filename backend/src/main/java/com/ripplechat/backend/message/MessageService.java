package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.ChannelMembershipGuard;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.redis.RateLimiter;
import com.ripplechat.backend.common.MessagePreview;
import com.ripplechat.backend.common.dto.PageResponse;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.notification.Notification;
import com.ripplechat.backend.notification.NotificationService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageEditHistoryEntry;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.message.dto.ReactionSummary;
import com.ripplechat.backend.message.dto.ThreadSummary;
import com.ripplechat.backend.message.dto.ThreadUpdate;
import com.ripplechat.backend.push.MessageSentEvent;
import com.ripplechat.backend.search.SearchService;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.dto.UserSummary;
import com.ripplechat.backend.user.UserRepository;
import com.ripplechat.backend.user.UserBlockRepository;
import com.ripplechat.backend.channel.ChannelType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import com.ripplechat.backend.redis.RedisBroadcastService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * The write path for messages: send, forward, edit, and the quote/mention/
 * attachment rules that go with them.
 *
 * <p>A send is the busiest operation in the app — it rate-limits, validates,
 * resolves a quoted message, persists, indexes for search, notifies mentions and
 * replies, and broadcasts — which is why this class has the dependency list it
 * does. Reads live in {@link MessageQueryService}, removal and pinning in
 * {@link MessageModerationService}.
 */
@Service
@RequiredArgsConstructor
public class MessageService {

    private static final int MAX_MESSAGE_LENGTH = 4000;
    // Send throttle: 10-message burst, then ~5/sec sustained per user.
    private static final double SEND_BURST = 10;
    private static final double SEND_REFILL_PER_SEC = 5;

    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final MessageEditHistoryRepository messageEditHistoryRepository;
    private final ChannelMembershipGuard membershipGuard;
    private final RedisBroadcastService redisBroadcastService;
    private final SearchService searchService;
    private final RateLimiter rateLimiter;
    private final ApplicationEventPublisher eventPublisher;
    private final NotificationService notificationService;
    private final UserBlockRepository blockRepository;
    private final MessageThreadSummaryService threadSummaryService;
    private final MessageBroadcastService broadcastService;

    // Matches @username mentions in message content (letters, digits, _ and .).
    private static final Pattern MENTION_PATTERN = Pattern.compile("@([A-Za-z0-9_.]+)");

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
        if (hasAttachment) {
            if (!isAllowedAttachmentUrl(attachmentUrl)) {
                throw new BadRequestException("invalid attachment url");
            }
            if (request.attachmentName() != null && request.attachmentName().length() > 255) {
                throw new BadRequestException("attachment name must be at most 255 characters");
            }
            if (request.attachmentType() != null && request.attachmentType().length() > 16) {
                throw new BadRequestException("attachment type must be at most 16 characters");
            }
        }

        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + channelId));
        if (channel.isDeleted()) {
            throw new ResourceNotFoundException("channel not found: " + channelId);
        }
        membershipGuard.requireMember(channelId, username);

        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        validateBlockState(channel, sender.getId());

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

        // Disappearing messages: stamp an expiry if the channel has a timer set.
        Integer ttl = channel.getMessageTtlSeconds();
        if (ttl != null && ttl > 0) {
            message.setExpiresAt(Instant.now().plusSeconds(ttl));
        }

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
                            preview = MessagePreview.ATTACHMENT;
                        }
                        message.setQuotedContent(preview.length() > 140 ? preview.substring(0, 140) : preview);
                    });
        }

        Message saved = messageRepository.saveAndFlush(message);
        searchService.indexMessage(saved);
        MessageResponse response = MessageResponse.from(saved);

        if (saved.getParent() == null) {
            redisBroadcastService.broadcast("/topic/channels/" + channelId, response);
        } else {
            UUID parentId = saved.getParent().getId();
            redisBroadcastService.broadcast("/topic/channels/" + channelId + "/thread/" + parentId, response);
            redisBroadcastService.broadcast("/topic/channels/" + channelId + "/thread-updates",
                    new ThreadUpdate(parentId, threadSummaryService.summaryFor(parentId)));
        }
        eventPublisher.publishEvent(new MessageSentEvent(channelId, saved.getId(), username));
        notifyMentionsAndReply(saved, sender, content, channelId);
        return response;
    }

    /**
     * Fans out activity notifications for a newly-sent message: the parent
     * author for a thread reply, and any @mentioned channel members. Deduped so a
     * mentioned parent author isn't notified twice, and never notifies the sender.
     */
    private void notifyMentionsAndReply(Message saved, User sender, String content, UUID channelId) {
        Set<UUID> notified = new HashSet<>();
        if (saved.getParent() != null) {
            User parentAuthor = saved.getParent().getSender();
            notificationService.notify(parentAuthor, sender,
                    Notification.TYPE_REPLY,
                    channelId, saved.getId(), content);
            if (parentAuthor != null) {
                notified.add(parentAuthor.getId());
            }
        }
        for (String mentioned : parseMentions(content)) {
            userRepository.findByUsername(mentioned).ifPresent(user -> {
                if (notified.add(user.getId())
                        && membershipRepository.existsByChannelIdAndUser_Username(channelId, mentioned)) {
                    notificationService.notify(user, sender,
                            Notification.TYPE_MENTION,
                            channelId, saved.getId(), content);
                }
            });
        }
    }

    private static Set<String> parseMentions(String content) {
        if (content == null || content.isBlank()) {
            return Set.of();
        }
        Set<String> names = new HashSet<>();
        Matcher m = MENTION_PATTERN.matcher(content);
        while (m.find()) {
            names.add(m.group(1));
        }
        return names;
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
        membershipGuard.requireMember(targetChannelId, username);

        Message source = messageRepository.findById(sourceMessageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + sourceMessageId));
        // You can only forward a message from a channel you're a member of.
        membershipGuard.requireMember(source.getChannel().getId(), username);
        if (source.isDeleted()) {
            throw new BadRequestException("cannot forward a deleted message");
        }

        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        validateBlockState(target, sender.getId());

        Message message = new Message();
        message.setContent(source.getContent() == null ? "" : source.getContent());
        // Carry the attachment's name and kind across too. Copying only the URL
        // left the forwarded copy with a null type, which the media gallery reads
        // as an image and the download card renders without a filename — a
        // forwarded PDF or voice note arrived broken.
        message.setAttachmentUrl(source.getAttachmentUrl());
        message.setAttachmentName(source.getAttachmentName());
        message.setAttachmentType(source.getAttachmentType());
        message.setForwarded(true);
        message.setChannel(target);
        message.setSender(sender);
        // A forward is a new message in the target channel, so the target's
        // disappearing-message timer applies to it. Without this, forwarding into
        // a channel with a timer was a way to make a message permanent there.
        Integer ttl = target.getMessageTtlSeconds();
        if (ttl != null && ttl > 0) {
            message.setExpiresAt(Instant.now().plusSeconds(ttl));
        }
        Message saved = messageRepository.saveAndFlush(message);
        searchService.indexMessage(saved);

        MessageResponse response = MessageResponse.from(saved);
        redisBroadcastService.broadcast("/topic/channels/" + targetChannelId, response);
        // Same as a normal send: offline members of the target channel get a push.
        eventPublisher.publishEvent(new MessageSentEvent(targetChannelId, saved.getId(), username));
        return response;
    }

    @Transactional
    public void editMessage(UUID channelId, UUID messageId, String username, String content) {
        Message message = requireOwnMessage(channelId, messageId, username);
        // A removed message has nothing to edit — silently ignore (idempotent).
        if (message.isDeleted()) {
            return;
        }
        // Invalid content is a client error, surfaced consistently with send()
        // rather than silently dropped.
        if (content == null || content.isBlank() || content.length() > MAX_MESSAGE_LENGTH) {
            throw new BadRequestException("content must be 1–" + MAX_MESSAGE_LENGTH + " characters");
        }
        String previous = message.getContent();
        if (previous.equals(content)) {
            return;
        }
        Instant now = Instant.now();
        // Snapshot the version being replaced so the edit history is auditable.
        messageEditHistoryRepository.save(new MessageEditHistory(message, previous, now));
        message.setContent(content);
        message.setEditedAt(now);
        messageRepository.saveAndFlush(message);
        searchService.indexMessage(message);
        broadcastService.broadcastUpdate(message);
    }

    private Message requireOwnMessage(UUID channelId, UUID messageId, String username) {
        membershipGuard.requireMember(channelId, username);
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

    private void validateBlockState(Channel channel, UUID senderId) {
        if (channel.getType() == ChannelType.DIRECT) {
            UUID otherParticipantId = membershipRepository.findByChannelId(channel.getId()).stream()
                    .map(m -> m.getUser().getId())
                    .filter(id -> !id.equals(senderId))
                    .findFirst()
                    .orElse(null);
            if (otherParticipantId != null) {
                if (blockRepository.existsByBlockerIdAndBlockedId(senderId, otherParticipantId)
                        || blockRepository.existsByBlockerIdAndBlockedId(otherParticipantId, senderId)) {
                    throw new ForbiddenException("cannot message a blocked user");
                }
            }
        }
    }

    /** Allows our own Cloudinary uploads and GIFs picked from Giphy. */
    private boolean isAllowedAttachmentUrl(String url) {
        if (url.startsWith(MessageMediaCleanupService.CLOUDINARY_PREFIX)) {
            return true;
        }
        try {
            String host = URI.create(url).getHost();
            return host != null && (host.equals("giphy.com") || host.endsWith(".giphy.com"));
        } catch (Exception e) {
            return false;
        }
    }
}
