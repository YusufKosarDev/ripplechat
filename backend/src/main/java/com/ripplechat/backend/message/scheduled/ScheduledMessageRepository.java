package com.ripplechat.backend.message.scheduled;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScheduledMessageRepository extends JpaRepository<ScheduledMessage, UUID> {

    /**
     * Pending rows that have come due — the dispatcher's work queue.
     *
     * <p>Bounded by the attempt count rather than by flipping {@code sent}: a
     * message that could not be delivered has not been sent, and retiring it as
     * though it had removed it from the author's pending list with nothing to
     * show for it. Leaving it visible, with its reason, is the honest state.
     */
    List<ScheduledMessage> findBySentFalseAndAttemptsLessThanAndScheduledAtLessThanEqual(
            int maxAttempts, Instant cutoff);

    /** A user's still-pending scheduled messages (channel fetched for the list view). */
    @EntityGraph(attributePaths = "channel")
    List<ScheduledMessage> findBySender_UsernameAndSentFalseOrderByScheduledAtAsc(String username);

    /** Scoped lookup so a user can only ever touch their own scheduled message. */
    Optional<ScheduledMessage> findByIdAndSender_Username(UUID id, String username);
}
