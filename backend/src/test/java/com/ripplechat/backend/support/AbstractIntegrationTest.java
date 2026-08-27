package com.ripplechat.backend.support;

import com.ripplechat.backend.auth.LoginLockoutService;
import com.ripplechat.backend.redis.RateLimiter;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Base for integration tests: boots the full Spring context against a real
 * PostgreSQL, Redis and Elasticsearch (Testcontainers) for production parity.
 * The containers are JVM-wide singletons (started once, reused across test classes).
 * {@code @Transactional} rolls each test back, keeping tests isolated and fast.
 */
@SpringBootTest
@Transactional
public abstract class AbstractIntegrationTest {

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        SharedContainers.apply(registry);
    }

    @Autowired
    protected UserRepository userRepository;
    @Autowired
    protected PasswordEncoder passwordEncoder;
    @Autowired
    private RateLimiter rateLimiter;
    @Autowired
    private LoginLockoutService loginLockoutService;

    /**
     * Reset the shared Redis-backed rate limiter and account-lockout state before
     * each test. Both are singletons whose keys live in the reused Redis container,
     * so without this their counters leak between tests and eventually trip.
     */
    @BeforeEach
    void resetLoginGuards() {
        rateLimiter.reset();
        loginLockoutService.clearAll();
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
