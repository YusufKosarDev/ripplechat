package com.ripplechat.backend.presence;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Set;

/**
 * Tracks online users in Redis by storing a set of active WebSocket session IDs
 * per user, so multiple tabs/nodes are handled correctly: a user is online while
 * at least one connection is open.
 */
@Service
public class PresenceService {

    private static final String PRESENCE_PREFIX = "presence:sessions:";
    /** A single set of currently-online usernames, kept in sync with the per-user session sets. */
    private static final String ONLINE_USERS_KEY = "presence:online";

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
        boolean justCameOnline = count != null && count == 1 && redisTemplate.opsForSet().size(key) == 1;
        if (justCameOnline) {
            redisTemplate.opsForSet().add(ONLINE_USERS_KEY, username);
        }
        return justCameOnline;
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
            boolean justWentOffline = size == null || size == 0;
            if (justWentOffline) {
                redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, username);
            }
            return justWentOffline;
        }
        return false;
    }

    /**
     * The set of online usernames. Reads a single Redis set ({@code SMEMBERS})
     * instead of scanning the keyspace with {@code KEYS}, which is O(N) over every
     * key and blocks the server.
     */
    public Set<String> onlineUsernames() {
        Set<String> members = redisTemplate.opsForSet().members(ONLINE_USERS_KEY);
        return members == null ? Collections.emptySet() : members;
    }
}
