package com.ripplechat.backend.scheduling;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * Wires ShedLock so the application's {@code @Scheduled} tasks acquire a
 * database-backed lock before running. On a single replica this is effectively a
 * no-op; across multiple replicas it elects one runner per tick, so the
 * disappearing-message sweep and the scheduled-message dispatcher never fire
 * redundantly (e.g. double-delivering a scheduled message).
 *
 * <p>The lock state lives in a {@code shedlock} table. In production that table
 * is owned by Flyway (migration {@code V25__shedlock.sql}); in dev/test (where
 * Flyway is disabled and Hibernate manages the schema) it is created here with a
 * guarded {@code CREATE TABLE IF NOT EXISTS} before the lock provider is used.
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT2M")
public class SchedulingConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource,
                                     @Value("${spring.flyway.enabled:false}") boolean flywayEnabled) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

        // Production keeps schema strictly Flyway-owned, so only create the table
        // ourselves when Flyway is off (dev/test, where Hibernate owns the schema
        // and never sees this non-entity table). IF NOT EXISTS keeps it idempotent.
        if (!flywayEnabled) {
            jdbcTemplate.execute(
                    "CREATE TABLE IF NOT EXISTS shedlock (" +
                    "  name VARCHAR(64) NOT NULL," +
                    "  lock_until TIMESTAMP NOT NULL," +
                    "  locked_at TIMESTAMP NOT NULL," +
                    "  locked_by VARCHAR(255) NOT NULL," +
                    "  PRIMARY KEY (name))");
        }

        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(jdbcTemplate)
                        // Use the database clock so locks compare consistently
                        // across replicas regardless of per-node clock skew.
                        .usingDbTime()
                        .build());
    }
}
