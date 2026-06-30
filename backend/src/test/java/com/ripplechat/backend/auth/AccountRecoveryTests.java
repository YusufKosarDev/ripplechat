package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.AuthResponse;
import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.auth.dto.RegisterRequest;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.mail.MailService;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class AccountRecoveryTests extends AbstractIntegrationTest {

    private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_-]+)");

    @Autowired
    AuthService authService;
    @Autowired
    AccountService accountService;

    // Capture the emailed links so the raw (un-hashed) token can be replayed.
    @MockitoBean
    MailService mailService;

    @Test
    void registerSendsVerificationLinkAndVerifyMarksEmailVerified() {
        authService.register(new RegisterRequest("alice", "alice@test.io", "Alice", "password123"));

        assertThat(userRepository.findByUsername("alice").orElseThrow().isEmailVerified()).isFalse();

        String token = tokenFromLinkContaining("/verify-email");
        accountService.verifyEmail(token);

        assertThat(userRepository.findByUsername("alice").orElseThrow().isEmailVerified()).isTrue();
    }

    @Test
    void forgotThenResetChangesPasswordAndRevokesSessions() {
        AuthResponse reg = authService.register(
                new RegisterRequest("bob", "bob@test.io", "Bob", "password123"));

        accountService.requestPasswordReset("bob@test.io", "1.2.3.4");
        String token = tokenFromLinkContaining("/reset-password");
        accountService.resetPassword(token, "newpassword456");

        // Old password no longer works; the new one does.
        assertThatThrownBy(() -> authService.login(new LoginRequest("bob", "password123")))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThat(authService.login(new LoginRequest("bob", "newpassword456")).accessToken()).isNotNull();

        // The reset revokes every pre-existing session.
        assertThatThrownBy(() -> authService.refresh(reg.refreshToken()))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void resetWithBogusTokenIsRejected() {
        assertThatThrownBy(() -> accountService.resetPassword("not-a-real-token", "newpassword456"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void forgotPasswordForUnknownEmailSendsNothing() {
        accountService.requestPasswordReset("nobody@test.io", "1.2.3.4");
        verify(mailService, never()).send(any(), any(), any());
    }

    /** Pulls the token query param out of the most recent emailed link that contains {@code part}. */
    private String tokenFromLinkContaining(String part) {
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mailService, org.mockito.Mockito.atLeastOnce()).send(any(), any(), body.capture());
        List<String> bodies = body.getAllValues();
        for (int i = bodies.size() - 1; i >= 0; i--) {
            if (bodies.get(i).contains(part)) {
                Matcher m = TOKEN.matcher(bodies.get(i));
                if (m.find()) {
                    return m.group(1);
                }
            }
        }
        throw new AssertionError("no emailed link contained " + part);
    }
}
