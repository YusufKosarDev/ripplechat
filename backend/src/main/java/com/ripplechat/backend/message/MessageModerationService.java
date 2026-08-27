package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.ChannelMembershipGuard;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.search.SearchService;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Everything that removes or flags an existing message: delete for everyone,
 * delete for me, pin/unpin, and the disappearing-message expiry sweep.
 *
 * <p>Split out of {@link MessageService}, which had grown to 592 lines and
 * fourteen dependencies. These operations share an authorisation shape (be a
 * member, then own the message or moderate the channel) and a soft-delete
 * routine that {@code MessageService} previously carried twice — once for an
 * explicit delete and once for the expiry sweep, which had already drifted
 * apart.
 */
@Service
@RequiredArgsConstructor
public class MessageModerationService {

    private final MessageRepository messageRepository;
    private final MessageHideRepository messageHideRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final ChannelMembershipGuard membershipGuard;
    private final UserRepository userRepository;
    private final MessageReactionService messageReactionService;
    private final MessageBroadcastService broadcastService;
    private final MessageMediaCleanupService mediaCleanup;
    private final SearchService searchService;

    @Transactional
    public void deleteMessage(UUID channelId, UUID messageId, String username) {
        Message message = requireMessageInChannel(channelId, messageId, username);
        // Owner of the message OR a channel moderator/owner may delete it.
        if (!message.getSender().getUsername().equals(username)) {
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
        softDelete(message);
    }

    @Transactional
    public void pin(UUID channelId, UUID messageId, String username) {
        setPinned(channelId, messageId, username, true);
    }

    @Transactional
    public void unpin(UUID channelId, UUID messageId, String username) {
        setPinned(channelId, messageId, username, false);
    }

    /** "Delete for me": hides the message from this user's feed only. */
    @Transactional
    public void hideForMe(UUID channelId, UUID messageId, String username) {
        requireMessageInChannel(channelId, messageId, username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        if (!messageHideRepository.existsByMessageIdAndUserId(messageId, user.getId())) {
            MessageHide hide = new MessageHide();
            hide.setMessageId(messageId);
            hide.setUserId(user.getId());
            messageHideRepository.save(hide);
        }
    }

    /**
     * Sweeps disappearing messages whose expiry has passed, so clients update to
     * the "deleted" placeholder. Invoked on a fixed delay by
     * {@link DisappearingMessageScheduler} (which holds the ShedLock lock); kept
     * as a plain transactional method so it can also be called directly (e.g. in
     * tests) without going through the scheduler lock.
     */
    @Transactional
    public void purgeExpired() {
        for (Message message : messageRepository.findByExpiresAtLessThanEqualAndDeletedFalse(Instant.now())) {
            softDelete(message);
        }
    }

    /**
     * The one soft-delete path. Clears the content and attachment, queues the
     * media for removal, drops reactions, un-indexes it and tells open clients.
     *
     * <p>This used to be written out separately in {@code deleteMessage} and
     * {@code purgeExpired}, and the two had already diverged: the expiry sweep
     * omitted {@code searchService.deleteMessage}, so an expired message stayed
     * findable in search after its content was gone.
     */
    private void softDelete(Message message) {
        mediaCleanup.enqueueDelete(message.getAttachmentUrl());
        message.setDeleted(true);
        message.setContent("");
        message.setAttachmentUrl(null);
        message.setAttachmentName(null);
        message.setAttachmentType(null);
        messageRepository.saveAndFlush(message);
        searchService.deleteMessage(message.getId());
        messageReactionService.deleteAllForMessage(message.getId());
        broadcastService.broadcastUpdate(message);
    }

    private void setPinned(UUID channelId, UUID messageId, String username, boolean pinned) {
        Message message = requireMessageInChannel(channelId, messageId, username);
        if (message.isPinned() == pinned) {
            return;
        }
        message.setPinned(pinned);
        messageRepository.saveAndFlush(message);
        broadcastService.broadcastUpdate(message);
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
