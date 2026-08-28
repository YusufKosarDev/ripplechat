package com.ripplechat.backend.auth.oauth2;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The OAuth2 authorization-request cookies carry the state value that binds the
 * provider's callback to the browser that started the flow.
 *
 * <p>Pure unit tests: the flow itself needs a Google client id, so the cookie
 * attributes were previously not covered by anything.
 */
class OAuth2CookieTest {

    private final HttpCookieOAuth2AuthorizationRequestRepository repository =
            new HttpCookieOAuth2AuthorizationRequestRepository(new ObjectMapper());

    private static OAuth2AuthorizationRequest anAuthorizationRequest() {
        return OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .clientId("client-id")
                .redirectUri("http://localhost:8081/login/oauth2/code/google")
                .scopes(java.util.Set.of("openid", "profile"))
                .state("the-state-value")
                .attributes(java.util.Map.of(
                        AuthorizationGrantType.AUTHORIZATION_CODE.getValue(), "google"))
                .build();
    }

    @Test
    void theCookieIsHttpOnlyAndSameSiteLax() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        repository.saveAuthorizationRequest(anAuthorizationRequest(), request, response);

        Cookie cookie = response.getCookie(
                HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME);
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        // Lax is the tightest setting that still works: the provider's callback
        // arrives as a top-level GET redirect, which Lax allows and Strict does not.
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");
        assertThat(cookie.getPath()).isEqualTo("/");
    }

    @Test
    void secureFollowsTheSchemeOfTheRequest() {
        MockHttpServletRequest plain = new MockHttpServletRequest();
        MockHttpServletResponse plainResponse = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(anAuthorizationRequest(), plain, plainResponse);
        assertThat(plainResponse.getCookie(
                HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME)
                .getSecure()).isFalse();

        MockHttpServletRequest secure = new MockHttpServletRequest();
        secure.setSecure(true);
        MockHttpServletResponse secureResponse = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(anAuthorizationRequest(), secure, secureResponse);
        // Over HTTPS the cookie must not be allowed onto a plaintext connection.
        assertThat(secureResponse.getCookie(
                HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME)
                .getSecure()).isTrue();
    }

    @Test
    void theRedirectUriCookieCarriesTheSameProtections() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSecure(true);
        request.setParameter(
                HttpCookieOAuth2AuthorizationRequestRepository.REDIRECT_URI_PARAM_COOKIE_NAME,
                "https://app.example.com/oauth2/redirect");
        MockHttpServletResponse response = new MockHttpServletResponse();

        repository.saveAuthorizationRequest(anAuthorizationRequest(), request, response);

        Cookie cookie = response.getCookie(
                HttpCookieOAuth2AuthorizationRequestRepository.REDIRECT_URI_PARAM_COOKIE_NAME);
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSecure()).isTrue();
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("Lax");
    }

    @Test
    void theSavedRequestRoundTrips() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(anAuthorizationRequest(), request, response);

        MockHttpServletRequest callback = new MockHttpServletRequest();
        callback.setCookies(response.getCookies());

        OAuth2AuthorizationRequest restored = repository.loadAuthorizationRequest(callback);
        assertThat(restored).isNotNull();
        // The state is the whole point of the cookie: it binds the callback to
        // the browser that began the flow.
        assertThat(restored.getState()).isEqualTo("the-state-value");
        assertThat(restored.getClientId()).isEqualTo("client-id");
    }
}
