package com.ripplechat.backend.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Set;

/**
 * Temporary account lockout: after too many failed password attempts for one
 * account, further attempts are refused until a cooldown elapses. This is
 * distinct from the per-identifier request rate limiter — it counts *failures*
 * specifically and applies a hard stop.
 *
 * <p>State lives in Redis (not the database) for two reasons: the counter must
 * survive the rollback of the failed-login transaction (Redis ops are outside
 * it), and the lock should auto-expire, which a Redis TTL gives for free.
 *
 * <p>The lock is deliberately <em>temporary</em> and auto-unlocking to bound the
 * denial-of-service surface (an attacker knowing a username can otherwise keep a
 * victim locked out); the demo account is exempt entirely.
 */
@Service
public class LoginLockoutService {

    private static final String FAIL_PREFIX = "loginfail:";
    private static final String LOCK_PREFIX = "loginlock:";

    private final StringRedisTemplate redis;
    private final SecurityAuditLogger audit;
    private final int maxAttempts;
    private final Duration lockDuration;
    private final Duration attemptWindow;

    public LoginLockoutService(StringRedisTemplate redis,
                               SecurityAuditLogger audit,
                               @Value("${app.security.lockout.max-attempts:10}") int maxAttempts,
                               @Value("${app.security.lockout.duration-minutes:15}") long lockMinutes,
                               @Value("${app.security.lockout.window-minutes:15}") long windowMinutes) {
        this.redis = redis;
        this.audit = audit;
        this.maxAttempts = maxAttempts;
        this.lockDuration = Duration.ofMinutes(lockMinutes);
        this.attemptWindow = Duration.ofMinutes(windowMinutes);
    }

    /** True while the account is within its lockout cooldown. */
    public boolean isLocked(String username) {
        return Boolean.TRUE.equals(redis.hasKey(LOCK_PREFIX + username));
    }

    /**
     * Records one failed password attempt; locks the account once the failures
     * within the counting window reach the threshold.
     */
    public void recordFailure(String username) {
        String failKey = FAIL_PREFIX + username;
        Long attempts = redis.opsForValue().increment(failKey);
        if (attempts != null && attempts == 1L) {
            // Start the sliding-ish window on the first failure.
            redis.expire(failKey, attemptWindow);
        }
        if (attempts != null && attempts >= maxAttempts) {
            redis.opsForValue().set(LOCK_PREFIX + username, "1", lockDuration);
            redis.delete(failKey);
            audit.accountLocked(username);
        }
    }

    /** Clears failure/lock state for an account (on a successful login). */
    public void reset(String username) {
        redis.delete(FAIL_PREFIX + username);
        redis.delete(LOCK_PREFIX + username);
    }

    /** Clears all lockout state. Intended for tests. */
    public void clearAll() {
        Set<String> keys = redis.keys(FAIL_PREFIX + "*");
        Set<String> locks = redis.keys(LOCK_PREFIX + "*");
        if (keys != null && !keys.isEmpty()) {
            redis.delete(keys);
        }
        if (locks != null && !locks.isEmpty()) {
            redis.delete(locks);
        }
    }
}
