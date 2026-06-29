package com.ripplechat.backend.user;

import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.dto.SetDndRequest;
import com.ripplechat.backend.user.dto.SetStatusRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class UserStatusTests extends AbstractIntegrationTest {

    @Autowired
    UserService userService;

    @Test
    void setsAndClearsCustomStatus() {
        createUser("statususer");

        var set = userService.updateStatus("statususer", new SetStatusRequest("🌴", "İzinde", null));
        assertThat(set.statusEmoji()).isEqualTo("🌴");
        assertThat(set.statusText()).isEqualTo("İzinde");

        var cleared = userService.updateStatus("statususer", new SetStatusRequest("", "  ", null));
        assertThat(cleared.statusEmoji()).isNull();
        assertThat(cleared.statusText()).isNull();
    }

    @Test
    void expiredStatusIsNotReturned() {
        User u = createUser("expireduser");
        u.setStatusEmoji("🔥");
        u.setStatusText("eski");
        u.setStatusExpiresAt(Instant.now().minusSeconds(60));
        userRepository.saveAndFlush(u);

        var res = userService.findByUsername("expireduser");
        assertThat(res.statusEmoji()).isNull();
        assertThat(res.statusText()).isNull();
    }

    @Test
    void doNotDisturbWindowIsReflectedThenCleared() {
        createUser("dnduser");

        var on = userService.updateDnd("dnduser", new SetDndRequest(30L));
        assertThat(on.dndUntil()).isNotNull().isAfter(Instant.now());

        var off = userService.updateDnd("dnduser", new SetDndRequest(0L));
        assertThat(off.dndUntil()).isNull();
    }
}
