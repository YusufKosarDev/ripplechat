package com.ripplechat.backend.message.scheduled;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Lets a user queue a message for future delivery to a channel and manage their
 * pending queue. {@link #deliver(UUID)} is invoked by {@code ScheduledMessageDispatcher}
 * when a row comes due; it reuses the normal {@link MessageService#send} pipeline,
 * so a delivered message is persisted, indexed, broadcast and pushed like any other.
 */
@Service
@RequiredArgsConstructor
public class ScheduledMessageService {

    private static final int MAX_MESSAGE_LENGTH = 4000;

    /** Deliveries to try before a scheduled message is abandoned. */
    private static final int MAX_DELIVERY_ATTEMPTS = 5;

    /** Pending messages one user may have queued at a time. */
    private static final int MAX_PENDING_PER_USER = 50;

    private final ScheduledMessageRepository repository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final MessageService messageService;

    @Transactional
    public ScheduledMessageResponse schedule(UUID channelId, String username, ScheduleMessageRequest request) {
        if (!membershipRepository.existsByChannelIdAndUser_Username(channelId, username)) {
            throw new ForbiddenException("not a member of this channel");
        }
        String content = request.content() == null ? "" : request.content().trim();
        if (content.isBlank()) {
            throw new BadRequestException("content is required");
        }
        if (content.length() > MAX_MESSAGE_LENGTH) {
            throw new BadRequestException("content must be at most " + MAX_MESSAGE_LENGTH + " characters");
        }
        if (request.scheduledAt() == null || !request.scheduledAt().isAfter(Instant.now())) {
            throw new BadRequestException("scheduledAt must be in the future");
        }
        // The queue is otherwise unbounded per user, and every pending row is
        // work the dispatcher picks up on each sweep.
        if (repository.findBySender_UsernameAndSentFalseOrderByScheduledAtAsc(username).size()
                >= MAX_PENDING_PER_USER) {
            throw new BadRequestException(
                    "you can have at most " + MAX_PENDING_PER_USER + " scheduled messages pending");
        }

        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + channelId));
        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        ScheduledMessage sm = new ScheduledMessage();
        sm.setChannel(channel);
        sm.setSender(sender);
        sm.setContent(content);
        sm.setScheduledAt(request.scheduledAt());
        return ScheduledMessageResponse.from(repository.save(sm));
    }

    @Transactional(readOnly = true)
    public List<ScheduledMessageResponse> listMine(String username) {
        return repository.findBySender_UsernameAndSentFalseOrderByScheduledAtAsc(username).stream()
                .map(ScheduledMessageResponse::from)
                .toList();
    }

    @Transactional
    public void cancel(UUID id, String username) {
        ScheduledMessage sm = repository.findByIdAndSender_Username(id, username)
                .orElseThrow(() -> new ResourceNotFoundException("scheduled message not found: " + id));
        if (sm.isSent()) {
            throw new BadRequestException("scheduled message has already been sent");
        }
        repository.delete(sm);
    }

    /** Ids of rows due for delivery (read-only; the dispatcher delivers each separately). */
    @Transactional(readOnly = true)
    public List<UUID> findDueIds() {
        return repository.findBySentFalseAndScheduledAtLessThanEqual(Instant.now()).stream()
                .map(ScheduledMessage::getId)
                .toList();
    }

    /**
     * Delivers one due message. Runs in its own transaction so a single bad row
     * cannot block the others, and {@code sent} only flips if the send succeeds.
     */
    @Transactional
    public void deliver(UUID id) {
        ScheduledMessage sm = repository.findById(id).orElse(null);
        if (sm == null || sm.isSent()) {
            return;
        }
        messageService.send(
                sm.getChannel().getId(),
                new CreateMessageRequest(sm.getContent(), null),
                sm.getSender().getUsername());
        sm.setSent(true);
    }

    /**
     * Records a failed delivery, and gives up after {@link #MAX_DELIVERY_ATTEMPTS}.
     *
     * <p>A message that can never be delivered — its author left the channel
     * after scheduling it, the channel was archived — came back due every 30
     * seconds for ever, throwing and logging each time and never leaving the
     * queue. Retiring it sets {@code sent}, which is what the due query filters
     * on, and keeps the reason on the row.
     *
     * <p>Separate from {@link #deliver} and called by the dispatcher rather than
     * from inside it: {@code deliver}'s transaction is already marked
     * rollback-only by the failure, so bookkeeping written there would be
     * discarded along with it.
     */
    @Transactional
    public void recordFailedDelivery(UUID id, String error) {
        repository.findById(id).ifPresent(sm -> {
            if (sm.isSent()) {
                return;
            }
            sm.setAttempts(sm.getAttempts() + 1);
            sm.setLastError(error);
            if (sm.getAttempts() >= MAX_DELIVERY_ATTEMPTS) {
                sm.setSent(true);
            }
        });
    }
}
