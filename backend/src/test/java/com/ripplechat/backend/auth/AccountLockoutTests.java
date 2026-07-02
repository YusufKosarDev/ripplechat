package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccountLockoutTests extends AbstractIntegrationTest {

    @Autowired
    AuthService authService;
    @Autowired
    LoginLockoutService loginLockoutService;

    @Test
    void locksOnlyOnceTheFailureThresholdIsReachedAndResetClearsIt() {
        String user = "victim";
        for (int i = 0; i < 9; i++) {
            loginLockoutService.recordFailure(user);
            assertThat(loginLockoutService.isLocked(user)).isFalse();
        }
        loginLockoutService.recordFailure(user); // 10th failure trips the lock
        assertThat(loginLockoutService.isLocked(user)).isTrue();

        loginLockoutService.reset(user);
        assertThat(loginLockoutService.isLocked(user)).isFalse();
    }

    @Test
    void lockedAccountIsRefusedEvenWithTheCorrectPassword() {
        createUser("victim"); // password "password123"
        for (int i = 0; i < 10; i++) {
            loginLockoutService.recordFailure("victim");
        }
        assertThat(loginLockoutService.isLocked("victim")).isTrue();

        assertThatThrownBy(() -> authService.login(new LoginRequest("victim", "password123")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.LOCKED));
    }

    @Test
    void demoAccountIsExemptFromLockout() {
        createUser("demo"); // the public one-click demo account
        for (int i = 0; i < 12; i++) {
            loginLockoutService.recordFailure("demo");
        }
        // The lock key is set, but login for the demo account ignores it.
        assertThat(loginLockoutService.isLocked("demo")).isTrue();
        assertThat(authService.login(new LoginRequest("demo", "password123")).accessToken()).isNotNull();
    }
}
