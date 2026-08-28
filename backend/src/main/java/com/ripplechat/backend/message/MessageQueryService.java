package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.ChannelMembershipGuard;
import com.ripplechat.backend.common.dto.PageResponse;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.dto.MediaItem;
import com.ripplechat.backend.message.dto.MessageEditHistoryEntry;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.message.dto.ReactionSummary;
import com.ripplechat.backend.message.dto.ThreadSummary;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Every read over messages: the channel feed, a thread's replies, a message's
 * edit history, the pinned list and the media gallery.
 *
 * <p>Reads are separated from writes because they need different things. Nothing
 * here broadcasts, indexes, rate-limits or notifies, so a caller that only wants
 * to display messages — {@code AiSummaryService}, the thread view — depends on
 * five collaborators rather than {@link MessageService}'s fifteen.
 *
 * <p>Every method is membership-checked: a caller who is not in the channel gets
 * the same "not found" as one asking about a channel that does not exist.
 */
@Service
@RequiredArgsConstructor
public class MessageQueryService {

    private final MessageRepository messageRepository;
    private final MessageEditHistoryRepository messageEditHistoryRepository;
    private final ChannelRepository channelRepository;
    private final ChannelMembershipGuard membershipGuard;
    private final UserRepository userRepository;
    private final MessageReactionService messageReactionService;
    private final MessageThreadSummaryService threadSummaryService;

    /**
     * A page of the channel's top-level feed, with reactions and thread summaries
     * attached in bulk rather than per row.
     */
    @Transactional(readOnly = true)
    public PageResponse<MessageResponse> findByChannel(UUID channelId, String username, Pageable pageable) {
        if (!channelRepository.existsById(channelId)) {
            throw new ResourceNotFoundException("channel not found: " + channelId);
        }
        membershipGuard.requireMember(channelId, username);

        User viewer = requireUser(username);
        var page = messageRepository.findChannelFeed(channelId, viewer.getId(), pageable);
        List<UUID> ids = page.getContent().stream().map(Message::getId).toList();
        Map<UUID, List<ReactionSummary>> reactions = messageReactionService.summariesByMessage(ids);
        Map<UUID, ThreadSummary> threads = threadSummaryService.summariesByParent(ids);

        return PageResponse.from(page.map(m -> MessageResponse.from(
                m,
                reactions.getOrDefault(m.getId(), List.of()),
                threads.getOrDefault(m.getId(), ThreadSummary.empty()))));
    }

    /** A thread's replies, oldest first. Replies carry no thread summary of their own. */
    @Transactional(readOnly = true)
    public List<MessageResponse> listThread(UUID channelId, UUID parentMessageId, String username) {
        Message parent = requireMessageInChannel(channelId, parentMessageId, username);
        User viewer = requireUser(username);

        List<Message> replies = messageRepository.findThreadReplies(parent.getId(), viewer.getId());
        Map<UUID, List<ReactionSummary>> reactions = messageReactionService.summariesByMessage(
                replies.stream().map(Message::getId).toList());

        return replies.stream()
                .map(m -> MessageResponse.from(m, reactions.getOrDefault(m.getId(), List.of()), ThreadSummary.empty()))
                .toList();
    }

    /**
     * Prior versions of a message, newest first — what the "(edited)" badge opens.
     *
     * <p>A removed message has no history to show. Deletion clears the rows, so
     * this is belt and braces: nothing should be able to reach an earlier
     * version of a message whose current version is gone.
     */
    @Transactional(readOnly = true)
    public List<MessageEditHistoryEntry> editHistory(UUID channelId, UUID messageId, String username) {
        Message message = requireMessageInChannel(channelId, messageId, username);
        if (message.isDeleted()) {
            return List.of();
        }
        return messageEditHistoryRepository.findByMessage_IdOrderByEditedAtDesc(messageId).stream()
                .map(MessageEditHistoryEntry::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> listPinned(UUID channelId, String username) {
        membershipGuard.requireMember(channelId, username);
        return messageRepository.findByChannelIdAndPinnedTrueAndDeletedFalseOrderByCreatedAtDesc(channelId).stream()
                .map(MessageResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MediaItem> listMedia(UUID channelId, String username) {
        membershipGuard.requireMember(channelId, username);
        return messageRepository.findByChannelIdAndAttachmentUrlIsNotNullAndDeletedFalseOrderByCreatedAtDesc(channelId)
                .stream()
                .filter(m -> m.getAttachmentType() == null || "image".equals(m.getAttachmentType())) // images only
                .map(MediaItem::from)
                .toList();
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
    }

    private Message requireMessageInChannel(UUID channelId, UUID messageId, String username) {
        membershipGuard.requireMember(channelId, username);
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("message not found: " + messageId));
        if (!message.getChannel().getId().equals(channelId)) {
            throw new ResourceNotFoundException("message not found in channel: " + messageId);
        }
        return message;
    }
}
