package com.ripplechat.backend.demo;

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
            return;
        }
        seedService.seedContentIfAbsent();
        seedService.seedDemoPoll();
    }
}
