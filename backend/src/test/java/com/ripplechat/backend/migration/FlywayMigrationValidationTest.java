package com.ripplechat.backend.migration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Reproduces the production database boot: Flyway applies every migration
 * (V1..VN) to an empty PostgreSQL, then Hibernate ({@code ddl-auto=validate})
 * checks each {@code @Entity} against the resulting schema.
 *
 * <p>A drift between an entity and the migrations — e.g. an entity column with
 * no matching migration — fails context startup, so this test catches exactly
 * the class of bug the regular integration tests cannot: those build the schema
 * from the entities ({@code ddl-auto=create-drop}, Flyway off), so a missing
 * migration is invisible to them but crashes the Flyway-managed prod schema.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class FlywayMigrationValidationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    @Test
    void migrationsSatisfyEntitySchema() {
        // Reaching here means the context loaded: Flyway migrated the empty
        // database and Hibernate validated every entity mapping against it.
    }
}
