package com.ripplechat.backend.outbox;

import com.ripplechat.backend.media.MediaStorage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxTaskProcessor {

    private final OutboxTaskRepository outboxTaskRepository;
    private final MediaStorage mediaStorage;

    @Scheduled(fixedDelayString = "${ripplechat.outbox.sweep-ms:5000}")
    @SchedulerLock(name = "outboxTaskSweep", lockAtMostFor = "PT2M", lockAtLeastFor = "PT0S")
    public void processTasks() {
        List<OutboxTask> pendingTasks = outboxTaskRepository.findPendingTasks(5);
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
                outboxTaskRepository.saveAndFlush(task);
            } catch (Exception e) {
                log.error("Failed to execute outbox task: {}", task.getId(), e);
                task.setStatus(OutboxTask.Status.FAILED);
                task.setErrorMessage(e.getMessage());
                outboxTaskRepository.saveAndFlush(task);
            }
        }
    }

    private void executeTask(OutboxTask task) throws Exception {
        if ("DELETE_MEDIA".equals(task.getTaskType())) {
            mediaStorage.delete(task.getPayload());
        } else {
            throw new IllegalArgumentException("Unknown task type: " + task.getTaskType());
        }
    }
}
