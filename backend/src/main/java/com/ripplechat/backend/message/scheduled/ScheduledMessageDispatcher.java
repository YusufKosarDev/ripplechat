package com.ripplechat.backend.message.scheduled;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Polls for due scheduled messages and delivers them. Kept separate from the
 * service so each {@link ScheduledMessageService#deliver} runs through the proxy
 * in its own transaction (one failing row never blocks the rest).
 *
 * <p>Single-instance friendly. On multiple replicas this would double-deliver,
 * so a distributed lock (e.g. ShedLock) would elect one runner — deferred until
 * the app actually runs multi-replica.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduledMessageDispatcher {

    private final ScheduledMessageService scheduledMessageService;

    @Scheduled(fixedDelayString = "${ripplechat.scheduled-messages.sweep-ms:30000}")
    public void dispatchDue() {
        for (UUID id : scheduledMessageService.findDueIds()) {
            try {
                scheduledMessageService.deliver(id);
            } catch (Exception e) {
                log.error("Failed to deliver scheduled message {}", id, e);
            }
        }
    }
}
