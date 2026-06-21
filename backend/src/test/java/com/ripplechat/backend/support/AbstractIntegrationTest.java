package com.ripplechat.backend.support;

import com.ripplechat.backend.common.RateLimiter;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base for integration tests: boots the full Spring context against a real
 * PostgreSQL (Testcontainers) for production parity. The container is a JVM-wide
 * singleton (started once, reused across test classes; Ryuk stops it at exit).
 * {@code @Transactional} rolls each test back, keeping tests isolated and fast.
 */
@SpringBootTest
@Transactional
public abstract class AbstractIntegrationTest {

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
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
