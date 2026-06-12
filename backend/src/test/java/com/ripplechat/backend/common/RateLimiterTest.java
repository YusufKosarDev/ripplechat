package com.ripplechat.backend.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure unit tests for the token-bucket limiter. Uses refill=0 for determinism. */
class RateLimiterTest {

    @Test
    void allowsUpToCapacityThenBlocks() {
        RateLimiter limiter = new RateLimiter();
        assertThat(limiter.tryAcquire("k", 3, 0)).isTrue();
        assertThat(limiter.tryAcquire("k", 3, 0)).isTrue();
        assertThat(limiter.tryAcquire("k", 3, 0)).isTrue();
        assertThat(limiter.tryAcquire("k", 3, 0)).isFalse(); // 4th over capacity, no refill
    }

    @Test
    void bucketsAreIndependentPerKey() {
        RateLimiter limiter = new RateLimiter();
        assertThat(limiter.tryAcquire("a", 1, 0)).isTrue();
        assertThat(limiter.tryAcquire("a", 1, 0)).isFalse();
        assertThat(limiter.tryAcquire("b", 1, 0)).isTrue(); // separate key, fresh bucket
    }
}
