package com.ripplechat.backend.support;

import com.ripplechat.backend.redis.RateLimiter;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.elasticsearch.ElasticsearchContainer;

/**
 * Base for integration tests: boots the full Spring context against a real
 * PostgreSQL, Redis and Elasticsearch (Testcontainers) for production parity.
 * The containers are JVM-wide singletons (started once, reused across test classes).
 * {@code @Transactional} rolls each test back, keeping tests isolated and fast.
 */
@SpringBootTest
@Transactional
public abstract class AbstractIntegrationTest {

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    @ServiceConnection(name = "redis")
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);

    static final ElasticsearchContainer ELASTICSEARCH = new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:8.12.2")
            .withEnv("discovery.type", "single-node")
            .withEnv("xpack.security.enabled", "false");

    static {
        POSTGRES.start();
        REDIS.start();
        ELASTICSEARCH.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", REDIS::getFirstMappedPort);
        registry.add("spring.elasticsearch.uris", ELASTICSEARCH::getHttpHostAddress);
    }

    @Autowired
    protected UserRepository userRepository;
    @Autowired
    protected PasswordEncoder passwordEncoder;
    @Autowired
    private RateLimiter rateLimiter;

    /**
     * Reset the in-memory rate limiter before each test. The limiter is a
     * singleton shared across the whole test context, so without this its
     * token-bucket state leaks between tests and eventually trips the limit.
     */
    @BeforeEach
    void resetRateLimiter() {
        rateLimiter.reset();
    }

    /** Persists a test user with a known password ("password123"). */
    protected User createUser(String username) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@test.io");
        user.setDisplayName(username);
        user.setPassword(passwordEncoder.encode("password123"));
        return userRepository.saveAndFlush(user);
    }
}
