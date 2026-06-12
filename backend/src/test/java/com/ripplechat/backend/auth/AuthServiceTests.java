package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.auth.dto.RegisterRequest;
import com.ripplechat.backend.common.exception.DuplicateResourceException;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

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
}
