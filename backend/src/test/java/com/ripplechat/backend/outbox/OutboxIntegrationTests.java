package com.ripplechat.backend.outbox;

import com.ripplechat.backend.media.MediaStorage;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

class OutboxIntegrationTests extends AbstractIntegrationTest {

    @Autowired
    private OutboxTaskRepository outboxTaskRepository;

    @Autowired
    private OutboxTaskProcessor outboxTaskProcessor;

    @MockBean
    private MediaStorage mediaStorage;

    @Test
    void testProcessPendingTaskSuccessfully() throws Exception {
        OutboxTask task = new OutboxTask();
        task.setId(UUID.randomUUID());
        task.setTaskType("DELETE_MEDIA");
        task.setPayload("https://res.cloudinary.com/test-image.jpg");
        task.setStatus(OutboxTask.Status.PENDING);
        task.setCreatedAt(Instant.now());
        outboxTaskRepository.saveAndFlush(task);

        outboxTaskProcessor.processTasks();

        OutboxTask processedTask = outboxTaskRepository.findById(task.getId()).orElseThrow();
        assertThat(processedTask.getStatus()).isEqualTo(OutboxTask.Status.COMPLETED);
        assertThat(processedTask.getAttempts()).isEqualTo(1);
        assertThat(processedTask.getErrorMessage()).isNull();

        verify(mediaStorage).delete("https://res.cloudinary.com/test-image.jpg");
    }

    @Test
    void testProcessPendingTaskFailsAndRetries() throws Exception {
        OutboxTask task = new OutboxTask();
        task.setId(UUID.randomUUID());
        task.setTaskType("DELETE_MEDIA");
        task.setPayload("https://res.cloudinary.com/fail-image.jpg");
        task.setStatus(OutboxTask.Status.PENDING);
        task.setCreatedAt(Instant.now());
        outboxTaskRepository.saveAndFlush(task);

        doThrow(new RuntimeException("Cloudinary API failure")).when(mediaStorage).delete("https://res.cloudinary.com/fail-image.jpg");

        outboxTaskProcessor.processTasks();

        OutboxTask processedTask = outboxTaskRepository.findById(task.getId()).orElseThrow();
        assertThat(processedTask.getStatus()).isEqualTo(OutboxTask.Status.FAILED);
        assertThat(processedTask.getAttempts()).isEqualTo(1);
        assertThat(processedTask.getErrorMessage()).isEqualTo("Cloudinary API failure");
        assertThat(processedTask.getNextAttemptAt()).isNotNull();
    }

    @Test
    void testFailedTaskWillNotBeProcessedBeforeNextAttemptAt() throws Exception {
        OutboxTask task = new OutboxTask();
        task.setId(UUID.randomUUID());
        task.setTaskType("DELETE_MEDIA");
        task.setPayload("https://res.cloudinary.com/fail-image-2.jpg");
        task.setStatus(OutboxTask.Status.FAILED);
        task.setAttempts(1);
        // next attempt is scheduled 10 seconds in the future
        task.setNextAttemptAt(Instant.now().plusSeconds(10));
        task.setCreatedAt(Instant.now().minusSeconds(20));
        outboxTaskRepository.saveAndFlush(task);

        // Execute processor
        outboxTaskProcessor.processTasks();

        // The task should NOT be processed again because nextAttemptAt is in the future.
        // So attempts count should remain 1.
        OutboxTask processedTask = outboxTaskRepository.findById(task.getId()).orElseThrow();
        assertThat(processedTask.getAttempts()).isEqualTo(1);
        assertThat(processedTask.getStatus()).isEqualTo(OutboxTask.Status.FAILED);
    }
}
