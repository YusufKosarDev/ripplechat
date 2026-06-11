package com.ripplechat.backend.common;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Minimal in-memory token-bucket rate limiter (no external dependency).
 *
 * <p>Each key (e.g. a username or a login identifier) gets a bucket that refills
 * continuously. {@link #tryAcquire} consumes one token and returns whether it
 * was available. Limits are tuned to be invisible to normal use and only bite
 * on abuse (brute-force / spam).
 *
 * <p>State is per-instance and lives in memory: it resets on restart and is not
 * shared across horizontally-scaled instances — acceptable for this purpose.
 */
@Component
public class RateLimiter {

    private static final class Bucket {
        double tokens;
        long lastRefillNanos;
    }

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    /**
     * @param key             bucket identity (caller should namespace, e.g. "login:" + name)
     * @param capacity        max burst (tokens the bucket can hold)
     * @param refillPerSecond tokens added per second (sustained rate)
     * @return true if a token was available and consumed, false if rate-limited
     */
    public boolean tryAcquire(String key, double capacity, double refillPerSecond) {
        long now = System.nanoTime();
        Bucket bucket = buckets.computeIfAbsent(key, k -> {
            Bucket b = new Bucket();
            b.tokens = capacity;
            b.lastRefillNanos = now;
            return b;
        });
        synchronized (bucket) {
            double elapsedSeconds = (now - bucket.lastRefillNanos) / 1_000_000_000.0;
            bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
            bucket.lastRefillNanos = now;
            if (bucket.tokens >= 1.0) {
                bucket.tokens -= 1.0;
                return true;
            }
            return false;
        }
    }
}
