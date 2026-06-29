package com.ripplechat.backend.message.scheduled;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScheduledMessageRepository extends JpaRepository<ScheduledMessage, UUID> {

    /** Pending rows that have come due — the dispatcher's work queue. */
    List<ScheduledMessage> findBySentFalseAndScheduledAtLessThanEqual(Instant cutoff);

    /** A user's still-pending scheduled messages (channel fetched for the list view). */
    @EntityGraph(attributePaths = "channel")
    List<ScheduledMessage> findBySender_UsernameAndSentFalseOrderByScheduledAtAsc(String username);

    /** Scoped lookup so a user can only ever touch their own scheduled message. */
    Optional<ScheduledMessage> findByIdAndSender_Username(UUID id, String username);
}
