package com.ripplechat.backend.demo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Runs the demo seeder on startup (dev and prod). Calls the @Transactional
 * service across the bean boundary so transactions apply. Can be disabled with
 * app.demo.seed=false.
 */
@Component
public class DemoDataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataInitializer.class);

    private final DemoSeedService seedService;
    private final boolean enabled;

    public DemoDataInitializer(DemoSeedService seedService,
                               @Value("${app.demo.seed:true}") boolean enabled) {
        this.seedService = seedService;
        this.enabled = enabled;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            log.info("Demo seed disabled (app.demo.seed=false)");
            return;
        }
        boolean created = seedService.seedContentIfAbsent();
        seedService.seedDemoPoll();
        log.info("Demo seed: {}", created ? "demo workspace created" : "demo user already present — skipped");
    }
}
