package com.ripplechat.backend.outbox;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "outbox_tasks")
@Getter
@Setter
public class OutboxTask {

    public enum Status {
        PENDING,
        PROCESSING,
        COMPLETED,
        FAILED,
        /**
         * Given up on. Without it a task that kept failing simply stopped being
         * picked up once it passed the attempt limit, and sat in FAILED for ever
         * looking like something still due — indistinguishable from one waiting
         * for its next backoff window.
         */
        DEAD
    }

    @Id
    private UUID id;

    @Column(name = "task_type", nullable = false)
    private String taskType;

    @Column(name = "payload", nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Status status = Status.PENDING;

    @Column(name = "attempts", nullable = false)
    private int attempts = 0;

    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;

    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
