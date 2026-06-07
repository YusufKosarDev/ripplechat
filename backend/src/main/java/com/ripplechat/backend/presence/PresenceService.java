package com.ripplechat.backend.presence;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks online users in memory by counting active WebSocket connections per
 * user, so multiple tabs are handled correctly: a user is online while at least
 * one connection is open.
 */
@Service
public class PresenceService {

    private final Map<String, Integer> connectionCounts = new ConcurrentHashMap<>();

    /**
     * Registers a new connection for the user.
     *
     * @return true if the user just came online (first connection).
     */
    public boolean connected(String username) {
        return connectionCounts.merge(username, 1, Integer::sum) == 1;
    }

    /**
     * Removes a connection for the user.
     *
     * @return true if the user just went offline (last connection closed).
     */
    public boolean disconnected(String username) {
        boolean[] wentOffline = {false};
        connectionCounts.computeIfPresent(username, (key, count) -> {
            if (count <= 1) {
                wentOffline[0] = true;
                return null;
            }
            return count - 1;
        });
        return wentOffline[0];
    }

    public Set<String> onlineUsernames() {
        return Set.copyOf(connectionCounts.keySet());
    }
}
