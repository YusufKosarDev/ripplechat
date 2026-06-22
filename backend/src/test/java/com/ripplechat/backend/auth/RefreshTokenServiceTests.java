package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.AuthResponse;
import com.ripplechat.backend.auth.dto.RegisterRequest;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RefreshTokenServiceTests extends AbstractIntegrationTest {

    @Autowired
    AuthService authService;
    @Autowired
    JwtService jwtService;

    private AuthResponse register(String username) {
        return authService.register(new RegisterRequest(username, username + "@test.io", null, "password123"));
    }

    @Test
    void registerIssuesBothAccessAndRefreshTokens() {
        AuthResponse res = register("ralph");
        assertThat(res.accessToken()).isNotBlank();
        assertThat(res.refreshToken()).isNotBlank();
    }

    @Test
    void refreshIssuesNewAccessAndRotatedRefreshToken() {
        AuthResponse res = register("rita");
        var refreshed = authService.refresh(res.refreshToken());

        assertThat(refreshed.accessToken()).isNotBlank();
        assertThat(jwtService.extractUsername(refreshed.accessToken())).isEqualTo("rita");
        // Rotation: the refresh token is replaced on use.
        assertThat(refreshed.refreshToken()).isNotEqualTo(res.refreshToken());
    }

    @Test
    void rotatedRefreshTokenCannotBeReused() {
        AuthResponse res = register("rob");
        authService.refresh(res.refreshToken()); // consumes the original

        assertThatThrownBy(() -> authService.refresh(res.refreshToken()))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void revokedRefreshTokenCannotBeUsed() {
        AuthResponse res = register("rose");
        authService.logout(res.refreshToken());

        assertThatThrownBy(() -> authService.refresh(res.refreshToken()))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void refreshRejectsUnknownToken() {
        assertThatThrownBy(() -> authService.refresh("not-a-valid-refresh-token"))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void activeSessionsTrackMetadataAndCanBeRevoked() {
        var regRequest = new RegisterRequest("sammy", "sammy@test.io", null, "password123");
        AuthResponse res = authService.register(regRequest, "12.34.56.78", "Mozilla/Firefox");

        var sessions = authService.getActiveSessions("sammy");
        assertThat(sessions).hasSize(1);
        var session = sessions.get(0);
        assertThat(session.ipAddress()).isEqualTo("12.34.56.78");
        assertThat(session.userAgent()).isEqualTo("Mozilla/Firefox");

        authService.revokeSession("sammy", session.id());

        assertThat(authService.getActiveSessions("sammy")).isEmpty();
    }
}
