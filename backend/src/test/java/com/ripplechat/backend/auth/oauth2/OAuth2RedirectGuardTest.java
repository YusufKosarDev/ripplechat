package com.ripplechat.backend.auth.oauth2;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The open-redirect guard on the OAuth2 success handler. Worth testing directly:
 * the redirect URL it authorises carries the access and refresh tokens as query
 * parameters, so anything it waves through is a credential leak.
 *
 * <p>Pure unit test — the handler's collaborators are never touched by this path.
 */
class OAuth2RedirectGuardTest {

    private OAuth2AuthenticationSuccessHandler handler;

    @BeforeEach
    void setUp() {
        // Constructor injection, so the config goes in directly rather than
        // being poked into private fields after the fact.
        handler = new OAuth2AuthenticationSuccessHandler(
                null, null, null,
                "https://ripplechat-app.vercel.app/oauth2/redirect",
                "https://chat.example.com,http://localhost:5173");
    }

    private boolean authorized(String uri) {
        try {
            Method m = OAuth2AuthenticationSuccessHandler.class
                    .getDeclaredMethod("isAuthorizedRedirectUri", String.class);
            m.setAccessible(true);
            return (boolean) m.invoke(handler, uri);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "https://chat.example.com/oauth2/redirect",
            "https://ripplechat-app.vercel.app/oauth2/redirect",
            "http://localhost:5173/oauth2/redirect",
            "/oauth2/redirect",
    })
    void allowsConfiguredOriginsAndRelativePaths(String uri) {
        assertThat(authorized(uri)).as(uri).isTrue();
    }

    /**
     * The regression this guard was missing: host and port alone treat
     * {@code http://x} and {@code https://x} as the same origin, because both
     * report port -1. A downgrade would hand the tokens over in plaintext.
     */
    @Test
    void rejectsASchemeDowngradeOnAnOtherwiseAllowedOrigin() {
        assertThat(authorized("http://chat.example.com/oauth2/redirect")).isFalse();
        assertThat(authorized("http://ripplechat-app.vercel.app/oauth2/redirect")).isFalse();
    }

    /** And the localhost entry is allowlisted as http, so https must not match it either. */
    @Test
    void rejectsASchemeUpgradeThatWasNotAllowlisted() {
        assertThat(authorized("https://localhost:5173/oauth2/redirect")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "https://evil.example.com/steal",
            "https://chat.example.com.evil.com/steal",
            "https://chat.example.com:8443/oauth2/redirect",
            "//evil.example.com/steal",
            "https:\\\\evil.example.com",
            "javascript:alert(1)",
            "",
    })
    void rejectsEverythingElse(String uri) {
        assertThat(authorized(uri)).as(uri).isFalse();
    }

    @Test
    void rejectsNull() {
        assertThat(authorized(null)).isFalse();
    }
}
