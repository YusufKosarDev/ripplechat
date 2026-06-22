package com.ripplechat.backend.presence;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Tracks online users in Redis by storing a set of active WebSocket session IDs
 * per user, so multiple tabs/nodes are handled correctly: a user is online while
 * at least one connection is open.
 */
@Service
public class PresenceService {

    private static final String PRESENCE_PREFIX = "presence:sessions:";

    private final StringRedisTemplate redisTemplate;

    public PresenceService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Registers a new connection for the user.
     *
     * @return true if the user just came online (first connection).
     */
    public boolean connected(String username, String sessionId) {
        String key = PRESENCE_PREFIX + username;
        Long count = redisTemplate.opsForSet().add(key, sessionId);
        return count != null && count == 1 && redisTemplate.opsForSet().size(key) == 1;
    }

    /**
     * Removes a connection for the user.
     *
     * @return true if the user just went offline (last connection closed).
     */
    public boolean disconnected(String username, String sessionId) {
        String key = PRESENCE_PREFIX + username;
        Long count = redisTemplate.opsForSet().remove(key, sessionId);
        if (count != null && count == 1) {
            Long size = redisTemplate.opsForSet().size(key);
            return size == null || size == 0;
        }
        return false;
    }

    public Set<String> onlineUsernames() {
        Set<String> keys = redisTemplate.keys(PRESENCE_PREFIX + "*");
        if (keys == null || keys.isEmpty()) {
            return Collections.emptySet();
        }
        return keys.stream()
                .map(key -> key.substring(PRESENCE_PREFIX.length()))
                .collect(Collectors.toSet());
    }
}
