package com.ripplechat.backend.message.scheduled;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Polls for due scheduled messages and delivers them. Kept separate from the
 * service so each {@link ScheduledMessageService#deliver} runs through the proxy
 * in its own transaction (one failing row never blocks the rest).
 *
 * <p>Guarded by ShedLock ({@link com.ripplechat.backend.scheduling.SchedulingConfig}):
 * across multiple replicas only one node runs the sweep per tick, so a due
 * message is never double-delivered.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduledMessageDispatcher {

    private final ScheduledMessageService scheduledMessageService;

    @Scheduled(fixedDelayString = "${ripplechat.scheduled-messages.sweep-ms:30000}")
    @SchedulerLock(name = "scheduledMessageDispatcher", lockAtMostFor = "PT2M", lockAtLeastFor = "PT0S")
    public void dispatchDue() {
        for (UUID id : scheduledMessageService.findDueIds()) {
            try {
                scheduledMessageService.deliver(id);
            } catch (Exception e) {
                // Recorded through the service so it lands in its own transaction:
                // deliver()'s is rollback-only by now. Without the attempt count a
                // message that can never be delivered came back due every 30
                // seconds for ever, logging a stack trace each time.
                log.warn("Scheduled message {} could not be delivered: {}", id, e.getMessage());
                scheduledMessageService.recordFailedDelivery(id, e.getMessage());
            }
        }
    }
}
