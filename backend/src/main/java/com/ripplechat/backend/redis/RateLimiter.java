package com.ripplechat.backend.redis;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Distributed token-bucket rate limiter using Redis.
 *
 * <p>Each key gets a bucket that refills continuously. {@link #tryAcquire}
 * consumes one token and returns whether it was available. Since it uses a Lua
 * script on Redis, it is fully atomic and works across horizontally-scaled instances.
 */
@Component
public class RateLimiter {

    private final StringRedisTemplate redisTemplate;
    private final DefaultRedisScript<Long> script;

    public RateLimiter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
        
        String lua = "local key = KEYS[1] " +
                "local capacity = tonumber(ARGV[1]) " +
                "local refill_rate = tonumber(ARGV[2]) " +
                "local now = tonumber(ARGV[3]) " +
                "local tokens_val = redis.call('HGET', key, 'tokens') " +
                "local last_refill_val = redis.call('HGET', key, 'last_refill') " +
                "local tokens = capacity " +
                "local last_refill = now " +
                "if tokens_val and tokens_val ~= false then " +
                "  tokens = tonumber(tokens_val) " +
                "  last_refill = tonumber(last_refill_val) " +
                "end " +
                "local elapsed = math.max(0, now - last_refill) " +
                "tokens = math.min(capacity, tokens + (elapsed * refill_rate)) " +
                "local allowed = 0 " +
                "if tokens >= 1 then " +
                "  tokens = tokens - 1 " +
                "  allowed = 1 " +
                "end " +
                "redis.call('HSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(now)) " +
                "local expire_time = 3600 " +
                "if refill_rate > 0 then " +
                "  expire_time = math.ceil(capacity / refill_rate) " +
                "end " +
                "redis.call('EXPIRE', key, expire_time) " +
                "return allowed";
                
        this.script = new DefaultRedisScript<>(lua, Long.class);
    }

    /**
     * @param key             bucket identity (caller should namespace, e.g. "login:" + name)
     * @param capacity        max burst (tokens the bucket can hold)
     * @param refillPerSecond tokens added per second (sustained rate)
     * @return true if a token was available and consumed, false if rate-limited
     */
    public boolean tryAcquire(String key, double capacity, double refillPerSecond) {
        long nowSeconds = System.currentTimeMillis() / 1000;
        Long allowed = redisTemplate.execute(
                script,
                List.of("ratelimit:" + key),
                String.valueOf(capacity),
                String.valueOf(refillPerSecond),
                String.valueOf(nowSeconds)
        );
        return allowed != null && allowed == 1L;
    }

    /**
     * Discards all buckets. Intended for tests.
     */
    public void reset() {
        Set<String> keys = redisTemplate.keys("ratelimit:*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }
}
