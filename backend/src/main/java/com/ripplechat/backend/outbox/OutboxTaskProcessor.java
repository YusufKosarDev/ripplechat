package com.ripplechat.backend.outbox;

import com.ripplechat.backend.media.MediaStorage;
import com.ripplechat.backend.search.SearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxTaskProcessor {

    private final OutboxTaskRepository outboxTaskRepository;
    private final MediaStorage mediaStorage;
    private final SearchService searchService;

    /** Attempts before a task is abandoned. */
    private static final int MAX_ATTEMPTS = 5;

    /** How long a task may sit in PROCESSING before it is treated as abandoned. */
    private static final Duration STUCK_AFTER = Duration.ofMinutes(5);

    /** Ceiling on the exponential backoff, which would otherwise run away. */
    private static final long MAX_BACKOFF_SECONDS = 3600;

    @Scheduled(fixedDelayString = "${ripplechat.outbox.sweep-ms:5000}")
    @SchedulerLock(name = "outboxTaskSweep", lockAtMostFor = "PT2M", lockAtLeastFor = "PT0S")
    public void processTasks() {
        Instant now = Instant.now();
        List<OutboxTask> pendingTasks =
                outboxTaskRepository.findPendingTasks(MAX_ATTEMPTS, now, now.minus(STUCK_AFTER));
        if (pendingTasks.isEmpty()) {
            return;
        }

        log.debug("Found {} pending outbox tasks to process", pendingTasks.size());

        for (OutboxTask task : pendingTasks) {
            try {
                task.setStatus(OutboxTask.Status.PROCESSING);
                task.setLastAttemptAt(Instant.now());
                task.setAttempts(task.getAttempts() + 1);
                outboxTaskRepository.saveAndFlush(task);

                executeTask(task);

                task.setStatus(OutboxTask.Status.COMPLETED);
                task.setErrorMessage(null);
                task.setNextAttemptAt(null);
                outboxTaskRepository.saveAndFlush(task);
            } catch (Exception e) {
                log.error("Failed to execute outbox task: {}", task.getId(), e);
                task.setErrorMessage(e.getMessage());
                if (task.getAttempts() >= MAX_ATTEMPTS) {
                    // Out of attempts. DEAD rather than FAILED so it is visibly
                    // abandoned instead of looking like one still awaiting retry.
                    task.setStatus(OutboxTask.Status.DEAD);
                    task.setNextAttemptAt(null);
                } else {
                    task.setStatus(OutboxTask.Status.FAILED);
                    long backoffSeconds = Math.min(
                            (long) Math.pow(2, task.getAttempts() - 1) * 10, MAX_BACKOFF_SECONDS);
                    task.setNextAttemptAt(Instant.now().plusSeconds(backoffSeconds));
                }
                outboxTaskRepository.saveAndFlush(task);
            }
        }
    }

    private void executeTask(OutboxTask task) throws Exception {
        switch (task.getTaskType()) {
            case OutboxTaskTypes.DELETE_MEDIA -> mediaStorage.delete(task.getPayload());
            case OutboxTaskTypes.INDEX_MESSAGE -> searchService.applyIndex(UUID.fromString(task.getPayload()));
            case OutboxTaskTypes.REMOVE_FROM_SEARCH_INDEX ->
                    searchService.applyDelete(UUID.fromString(task.getPayload()));
            default -> throw new IllegalArgumentException("Unknown task type: " + task.getTaskType());
        }
    }
}
