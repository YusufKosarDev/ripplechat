package com.ripplechat.backend.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

/**
 * Makes already-issued access tokens stop working.
 *
 * <p>Access tokens are stateless JWTs, so until now nothing could take one back:
 * banning an account, signing out, revoking another device or erasing the
 * account all dropped the refresh token and left the access token valid for the
 * rest of its hour. The account was locked out of getting a <em>new</em>
 * session while the existing one kept working.
 *
 * <p>Rather than a per-token denylist, this records one "tokens issued before
 * this instant are void" watermark per user. A token carries its {@code iat}, so
 * one Redis read decides it. Redis already carries presence, rate limiting and
 * lockout state, so this adds no new infrastructure.
 *
 * <p>The watermark only has to outlive the tokens it invalidates — after that
 * they expire on their own — so it is stored with the access-token lifetime as
 * its TTL.
 *
 * <p><strong>Fails open.</strong> If Redis is unreachable the request is allowed
 * through, with a warning. The alternative is that a Redis blip signs everybody
 * out, which is the same posture the rest of the application takes.
 */
@Service
public class TokenRevocationService {

    private static final Logger log = LoggerFactory.getLogger(TokenRevocationService.class);
    private static final String KEY_PREFIX = "tokensValidAfter:";

    private final StringRedisTemplate redis;
    private final Duration accessTokenLifetime;

    public TokenRevocationService(StringRedisTemplate redis,
                                  @Value("${jwt.access-expiration}") long accessExpirationMillis) {
        this.redis = redis;
        // A watermark shorter than the token it voids would let the token come
        // back to life; pad it so clock skew between replicas cannot do that.
        this.accessTokenLifetime = Duration.ofMillis(Math.max(accessExpirationMillis, 0)).plusMinutes(5);
    }

    /**
     * Voids every access token issued to this user up to and including the
     * current second. Call it from any path that ends a session: sign-out, ban,
     * password change, account erasure, revoking a device.
     *
     * <p>The watermark is the <em>next</em> second, not this one, because
     * {@code iat} has one-second granularity: a token minted in the same second
     * as the ban would otherwise slip through, and a ban that takes up to a
     * second to bite is a ban with a hole in it. The cost is the reverse edge —
     * signing straight back in within the same second yields a token that is
     * also voided — and that one repairs itself, because the client renews on
     * the resulting 401 and the renewed token is past the watermark.
     */
    public void revokeBefore(String username) {
        if (username == null || username.isBlank()) {
            return;
        }
        try {
            redis.opsForValue().set(KEY_PREFIX + username,
                    String.valueOf(Instant.now().getEpochSecond() + 1), accessTokenLifetime);
        } catch (RuntimeException e) {
            log.warn("Could not record token revocation for {}: {}", username, e.getMessage());
        }
    }

    /** Whether a token issued at {@code issuedAt} has been voided. */
    public boolean isRevoked(String username, Instant issuedAt) {
        if (username == null || issuedAt == null) {
            return false;
        }
        try {
            String watermark = redis.opsForValue().get(KEY_PREFIX + username);
            if (watermark == null) {
                return false;
            }
            return issuedAt.getEpochSecond() < Long.parseLong(watermark);
        } catch (RuntimeException e) {
            log.warn("Could not read token revocation state for {}: {}", username, e.getMessage());
            return false;
        }
    }

    /** Lifts the watermark. Intended for tests. */
    public void clear(String username) {
        try {
            redis.delete(KEY_PREFIX + username);
        } catch (RuntimeException e) {
            log.warn("Could not clear token revocation state for {}: {}", username, e.getMessage());
        }
    }

    /** Lifts every watermark. Intended for tests, which share one Redis. */
    public void clearAll() {
        try {
            Set<String> keys = redis.keys(KEY_PREFIX + "*");
            if (keys != null && !keys.isEmpty()) {
                redis.delete(keys);
            }
        } catch (RuntimeException e) {
            log.warn("Could not clear token revocation state: {}", e.getMessage());
        }
    }
}
