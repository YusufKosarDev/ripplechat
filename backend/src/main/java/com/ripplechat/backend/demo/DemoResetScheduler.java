package com.ripplechat.backend.demo;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly reset of the shared demo account (see
 * {@link DemoSeedService#resetMutableDemoState()}). Anyone can log in as
 * "demo", so its credentials, profile and channel list drift over the day;
 * this restores the seed state every night. Follows the repo rule that
 * {@code @SchedulerLock} only wraps the scheduler entry point, with the
 * transactional work behind a bean boundary.
 */
@Component
public class DemoResetScheduler {

    private static final Logger log = LoggerFactory.getLogger(DemoResetScheduler.class);

    private final DemoSeedService seedService;

    public DemoResetScheduler(DemoSeedService seedService) {
        this.seedService = seedService;
    }

    @Scheduled(cron = "${ripplechat.demo.reset-cron:0 0 3 * * *}")
    @SchedulerLock(name = "demoNightlyReset", lockAtMostFor = "PT5M", lockAtLeastFor = "PT0S")
    public void resetDemoWorkspace() {
        seedService.resetMutableDemoState();
        log.info("Demo account reset to seed state");
    }
}
