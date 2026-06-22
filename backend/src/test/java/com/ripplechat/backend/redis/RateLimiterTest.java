package com.ripplechat.backend.redis;

import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/** Integration tests for the Redis token-bucket limiter. Uses refill=0 for determinism. */
class RateLimiterTest extends AbstractIntegrationTest {

    @Autowired
    private RateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter.reset();
    }

    @Test
    void allowsUpToCapacityThenBlocks() {
        assertThat(limiter.tryAcquire("k", 3, 0)).isTrue();
        assertThat(limiter.tryAcquire("k", 3, 0)).isTrue();
        assertThat(limiter.tryAcquire("k", 3, 0)).isTrue();
        assertThat(limiter.tryAcquire("k", 3, 0)).isFalse(); // 4th over capacity, no refill
    }

    @Test
    void bucketsAreIndependentPerKey() {
        assertThat(limiter.tryAcquire("a", 1, 0)).isTrue();
        assertThat(limiter.tryAcquire("a", 1, 0)).isFalse();
        assertThat(limiter.tryAcquire("b", 1, 0)).isTrue(); // separate key, fresh bucket
    }
}
