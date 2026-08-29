package com.ripplechat.backend.outbox;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OutboxTaskRepository extends JpaRepository<OutboxTask, UUID> {

    /**
     * Tasks the processor should pick up: never-attempted ones, ones whose
     * backoff has elapsed, and ones stuck in PROCESSING.
     *
     * <p>The stuck case matters because the status is written before the work
     * runs: a crash or a redeploy mid-task left the row in PROCESSING, which
     * nothing ever selected again — the media it was going to delete stayed on
     * the CDN for ever. A row that has been PROCESSING longer than any attempt
     * plausibly takes is treated as abandoned and retried.
     */
    @Query("""
            SELECT t FROM OutboxTask t
            WHERE t.attempts < :maxAttempts
              AND (t.status = com.ripplechat.backend.outbox.OutboxTask.Status.PENDING
                   OR (t.status = com.ripplechat.backend.outbox.OutboxTask.Status.FAILED
                       AND (t.nextAttemptAt IS NULL OR t.nextAttemptAt <= :now))
                   OR (t.status = com.ripplechat.backend.outbox.OutboxTask.Status.PROCESSING
                       AND t.lastAttemptAt IS NOT NULL AND t.lastAttemptAt <= :stuckBefore))
            ORDER BY t.createdAt ASC
            """)
    List<OutboxTask> findPendingTasks(@Param("maxAttempts") int maxAttempts,
                                      @Param("now") Instant now,
                                      @Param("stuckBefore") Instant stuckBefore);
}
