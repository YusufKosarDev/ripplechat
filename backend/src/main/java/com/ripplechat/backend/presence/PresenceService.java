package com.ripplechat.backend.presence;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
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

    /**
     * How long a user's session set survives without a connect.
     *
     * <p>Presence is maintained by STOMP connect/disconnect events, and a replica
     * that dies without emitting the disconnect — a crash, an OOM kill, a
     * redeploy — used to leave its session ids behind for ever. The user then
     * showed as online permanently, and, because push deliberately skips anyone
     * online, silently stopped receiving notifications. A ceiling means the
     * stale entry ages out on its own.
     */
    private static final Duration SESSION_TTL = Duration.ofHours(12);

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
        // Refreshed on every connection, so an active user's set never expires.
        redisTemplate.expire(key, SESSION_TTL);
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
     *
     * <p>Members whose session set has expired are dropped as they are found.
     * Redis has no per-member TTL, so the roster cannot expire an entry on its
     * own — this is what stops a user stranded by a crashed replica from showing
     * as online for ever. The cost is one existence check per online user, on a
     * call made when a client opens the app or reconnects.
     */
    public Set<String> onlineUsernames() {
        Set<String> members = redisTemplate.opsForSet().members(ONLINE_USERS_KEY);
        if (members == null || members.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> live = new LinkedHashSet<>();
        List<String> stale = new ArrayList<>();
        for (String username : members) {
            if (Boolean.TRUE.equals(redisTemplate.hasKey(PRESENCE_PREFIX + username))) {
                live.add(username);
            } else {
                stale.add(username);
            }
        }
        if (!stale.isEmpty()) {
            redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, stale.toArray());
        }
        return live;
    }
}
