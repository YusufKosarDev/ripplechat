package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.auth.dto.RegisterRequest;
import com.ripplechat.backend.auth.dto.Verify2FaRequest;
import com.ripplechat.backend.common.exception.DuplicateResourceException;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthServiceTests extends AbstractIntegrationTest {

    @Autowired
    AuthService authService;
    @Autowired
    JwtService jwtService;

    @Test
    void registerPersistsUserAndReturnsUsableToken() {
        var res = authService.register(new RegisterRequest("alice", "alice@test.io", "Alice", "password123"));
        assertThat(res.accessToken()).isNotBlank();
        assertThat(jwtService.extractUsername(res.accessToken())).isEqualTo("alice");
        assertThat(userRepository.existsByUsername("alice")).isTrue();
    }

    @Test
    void registerRejectsDuplicateUsername() {
        authService.register(new RegisterRequest("bob", "bob@test.io", null, "password123"));
        assertThatThrownBy(() ->
                authService.register(new RegisterRequest("bob", "other@test.io", null, "password123")))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void registerRejectsDuplicateEmail() {
        authService.register(new RegisterRequest("carol", "dup@test.io", null, "password123"));
        assertThatThrownBy(() ->
                authService.register(new RegisterRequest("carol2", "dup@test.io", null, "password123")))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void loginSucceedsWithCorrectPassword() {
        authService.register(new RegisterRequest("dave", "dave@test.io", null, "password123"));
        var res = authService.login(new LoginRequest("dave", "password123"));
        assertThat(res.accessToken()).isNotBlank();
        assertThat(res.user().username()).isEqualTo("dave");
    }

    @Test
    void loginFailsWithWrongPassword() {
        authService.register(new RegisterRequest("erin", "erin@test.io", null, "password123"));
        assertThatThrownBy(() -> authService.login(new LoginRequest("erin", "wrong-password")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void loginFailsForUnknownUser() {
        assertThatThrownBy(() -> authService.login(new LoginRequest("ghost", "password123")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void registrationIsThrottledPerIp() {
        String ip = "203.0.113.9";
        // The burst (5) of registrations from one IP is allowed...
        for (int i = 0; i < 5; i++) {
            authService.register(new RegisterRequest("reg" + i, "reg" + i + "@test.io", null, "password123"), ip, "ua");
        }
        // ...the sixth is throttled (429), independent of the username being new.
        assertThatThrownBy(() ->
                authService.register(new RegisterRequest("reg5", "reg5@test.io", null, "password123"), ip, "ua"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void twoFactorVerificationIsThrottled() {
        authService.register(new RegisterRequest("twofa", "twofa@test.io", null, "password123"));
        User user = userRepository.findByUsername("twofa").orElseThrow();
        user.setTwoFactorEnabled(true);
        user.setTotpSecret("ABCDEFGHIJKLMNOP"); // any non-null secret; codes below are wrong anyway
        userRepository.saveAndFlush(user);

        String preAuthToken = jwtService.generatePreAuthToken("twofa");
        Verify2FaRequest badCode = new Verify2FaRequest(preAuthToken, "000000");

        // The first 5 wrong-code attempts fail on the code itself...
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> authService.verify2FaLogin(badCode))
                    .isInstanceOf(InvalidCredentialsException.class);
        }
        // ...the sixth is throttled (429) before the code is even checked.
        assertThatThrownBy(() -> authService.verify2FaLogin(badCode))
                .isInstanceOf(ResponseStatusException.class);
    }
}
