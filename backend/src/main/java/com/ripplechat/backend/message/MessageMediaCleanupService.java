package com.ripplechat.backend.message;

import com.ripplechat.backend.outbox.OutboxTask;
import com.ripplechat.backend.outbox.OutboxTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Schedules removal of a deleted message's uploaded media.
 *
 * <p>Goes through the transactional outbox rather than calling Cloudinary
 * inline: the delete has to commit or roll back with the message row, and a
 * best-effort call from inside the transaction would leak files whenever the
 * request failed afterwards. {@code OutboxTaskProcessor} drains the queue.
 */
@Service
@RequiredArgsConstructor
public class MessageMediaCleanupService {

    /** Only our own uploads are ours to delete; a Giphy URL is not. */
    static final String CLOUDINARY_PREFIX = "https://res.cloudinary.com/";

    private final OutboxTaskRepository outboxTaskRepository;

    public void enqueueDelete(String url) {
        if (url == null || url.isBlank() || !url.startsWith(CLOUDINARY_PREFIX)) {
            return;
        }
        OutboxTask task = new OutboxTask();
        task.setId(UUID.randomUUID());
        task.setTaskType("DELETE_MEDIA");
        task.setPayload(url);
        task.setStatus(OutboxTask.Status.PENDING);
        task.setCreatedAt(Instant.now());
        outboxTaskRepository.save(task);
    }
}
