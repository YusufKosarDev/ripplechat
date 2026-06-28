package com.ripplechat.backend.presence;

import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class PresenceServiceTests extends AbstractIntegrationTest {

    @Autowired
    PresenceService presenceService;

    @Test
    void tracksOnlineStateAcrossMultipleSessions() {
        String user = "presence-user-" + System.nanoTime();

        assertThat(presenceService.onlineUsernames()).doesNotContain(user);

        // First connection brings the user online.
        assertThat(presenceService.connected(user, "session-1")).isTrue();
        assertThat(presenceService.onlineUsernames()).contains(user);

        // A second tab does not re-announce them as newly online.
        assertThat(presenceService.connected(user, "session-2")).isFalse();
        assertThat(presenceService.onlineUsernames()).contains(user);

        // Closing one of two tabs keeps the user online.
        assertThat(presenceService.disconnected(user, "session-1")).isFalse();
        assertThat(presenceService.onlineUsernames()).contains(user);

        // Closing the last tab takes them offline and out of the online set.
        assertThat(presenceService.disconnected(user, "session-2")).isTrue();
        assertThat(presenceService.onlineUsernames()).doesNotContain(user);
    }
}
