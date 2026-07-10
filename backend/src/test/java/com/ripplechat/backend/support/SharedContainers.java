package com.ripplechat.backend.support;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.elasticsearch.ElasticsearchContainer;

/**
 * JVM-wide singleton containers shared by every integration test, including
 * the websocket tests that boot their own (RANDOM_PORT) application contexts.
 * Before this, those tests started a second PostgreSQL/Redis/Elasticsearch
 * trio next to the shared one — Elasticsearch alone costs ~1 GB and a minute
 * of startup, which both slowed CI and made the suite flaky under Docker
 * memory pressure.
 *
 * <p>Deliberately NOT used by the Flyway migration validation test: that one
 * needs an empty database for a clean V1..VN run, while this shared instance
 * carries the Hibernate-managed schema and test data.
 */
public final class SharedContainers {

    public static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    public static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);

    public static final ElasticsearchContainer ELASTICSEARCH =
            new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:9.4.2")
                    .withEnv("discovery.type", "single-node")
                    .withEnv("xpack.security.enabled", "false");

    static {
        POSTGRES.start();
        REDIS.start();
        ELASTICSEARCH.start();
    }

    private SharedContainers() {
    }

    /** Points a test context's datasource/Redis/Elasticsearch at the shared containers. */
    public static void apply(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", REDIS::getFirstMappedPort);
        registry.add("spring.elasticsearch.uris", ELASTICSEARCH::getHttpHostAddress);
    }
}
