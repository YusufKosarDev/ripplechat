package com.ripplechat.backend.outbox;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface OutboxTaskRepository extends JpaRepository<OutboxTask, UUID> {

    @Query("SELECT t FROM OutboxTask t WHERE (t.status = com.ripplechat.backend.outbox.OutboxTask.Status.PENDING OR (t.status = com.ripplechat.backend.outbox.OutboxTask.Status.FAILED AND t.attempts < :maxAttempts)) AND (t.nextAttemptAt IS NULL OR t.nextAttemptAt <= :now) ORDER BY t.createdAt ASC")
    List<OutboxTask> findPendingTasks(@Param("maxAttempts") int maxAttempts, @Param("now") java.time.Instant now);
}
