package com.ripplechat.backend.message;

import lombok.RequiredArgsConstructor;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Fires the disappearing-message sweep on a fixed delay, guarded by ShedLock so
 * that across multiple replicas only one node runs it per tick.
 *
 * <p>Deliberately a thin trigger separate from {@link MessageService#purgeExpired()}:
 * {@code @SchedulerLock} must only ever wrap the scheduler entry point. Annotating
 * the business method directly would also intercept direct callers (tests),
 * acquiring the lock inside their transaction and corrupting transaction
 * boundaries — so the lock lives here and the work stays a plain method.
 */
@Component
@RequiredArgsConstructor
public class DisappearingMessageScheduler {

    private final MessageService messageService;

    @Scheduled(fixedDelayString = "${ripplechat.disappearing.sweep-ms:30000}")
    @SchedulerLock(name = "disappearingMessageSweep", lockAtMostFor = "PT2M", lockAtLeastFor = "PT0S")
    public void sweep() {
        messageService.purgeExpired();
    }
}
