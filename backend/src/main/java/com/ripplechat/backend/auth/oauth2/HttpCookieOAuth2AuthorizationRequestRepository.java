package com.ripplechat.backend.auth.oauth2;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Component
public class HttpCookieOAuth2AuthorizationRequestRepository implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    public static final String OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME = "oauth2_auth_request";
    public static final String REDIRECT_URI_PARAM_COOKIE_NAME = "redirect_uri";
    private static final int cookieExpireSeconds = 180;

    private final ObjectMapper objectMapper;

    public HttpCookieOAuth2AuthorizationRequestRepository(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        return getCookie(request, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME)
                .map(this::deserialize)
                .orElse(null);
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest, HttpServletRequest request, HttpServletResponse response) {
        if (authorizationRequest == null) {
            removeCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME);
            removeCookie(request, response, REDIRECT_URI_PARAM_COOKIE_NAME);
            return;
        }

        boolean secure = request.isSecure();
        addCookie(response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME,
                serialize(authorizationRequest), cookieExpireSeconds, secure);
        String redirectUriAfterLogin = request.getParameter(REDIRECT_URI_PARAM_COOKIE_NAME);
        if (redirectUriAfterLogin != null && !redirectUriAfterLogin.isBlank()) {
            addCookie(response, REDIRECT_URI_PARAM_COOKIE_NAME, redirectUriAfterLogin, cookieExpireSeconds, secure);
        } else {
            // This flow asked for no particular redirect, so it must not inherit
            // one from a flow that did. Harmless while nothing read the cookie;
            // now that the success handler does, a stale value would quietly
            // send this sign-in somewhere the caller never asked for.
            removeCookie(request, response, REDIRECT_URI_PARAM_COOKIE_NAME);
        }
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request, HttpServletResponse response) {
        OAuth2AuthorizationRequest authorizationRequest = loadAuthorizationRequest(request);
        removeCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME);
        // The redirect-uri cookie deliberately survives this: it is read by the
        // success handler, which runs after Spring has removed the request above,
        // and cleared there.
        return authorizationRequest;
    }

    /**
     * The redirect the client asked for when it started the flow.
     *
     * <p>It has to travel in a cookie: the provider's callback is a fresh request
     * that carries only {@code code} and {@code state}, so the parameter the
     * client sent to {@code /oauth2/authorization/...} is long gone by then. It
     * was being saved and never read, which meant a client's requested redirect
     * was silently ignored and everyone landed on the configured default —
     * fine for a single-origin deployment, wrong for any other, and invisible
     * either way. The caller still validates it against the allow-list.
     */
    public static Optional<String> savedRedirectUri(HttpServletRequest request) {
        return getCookie(request, REDIRECT_URI_PARAM_COOKIE_NAME)
                .map(Cookie::getValue)
                .filter(value -> !value.isBlank());
    }

    /** Clears the redirect-uri cookie once the flow it belongs to is finished. */
    public void removeRedirectUriCookie(HttpServletRequest request, HttpServletResponse response) {
        removeCookie(request, response, REDIRECT_URI_PARAM_COOKIE_NAME);
    }

    /**
     * These cookies carry the in-flight authorization request, including the
     * state value that binds the provider's callback to the browser that started
     * it.
     *
     * <p>{@code Secure} over HTTPS keeps them off a plaintext connection;
     * {@code SameSite=Lax} is the tightest setting that still works, because the
     * callback arrives as a top-level GET redirect from the provider. Neither
     * was set, so they travelled on any scheme and on any cross-site request.
     */
    private void addCookie(HttpServletResponse response, String name, String value, int maxAge, boolean secure) {
        Cookie cookie = new Cookie(name, value);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setSecure(secure);
        cookie.setAttribute("SameSite", "Lax");
        cookie.setMaxAge(maxAge);
        response.addCookie(cookie);
    }

    private void removeCookie(HttpServletRequest request, HttpServletResponse response, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (cookie.getName().equals(name)) {
                    cookie.setValue("");
                    cookie.setPath("/");
                    cookie.setMaxAge(0);
                    response.addCookie(cookie);
                }
            }
        }
    }

    private static Optional<Cookie> getCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (cookie.getName().equals(name)) {
                    return Optional.of(cookie);
                }
            }
        }
        return Optional.empty();
    }

    private String serialize(OAuth2AuthorizationRequest authorizationRequest) {
        try {
            OAuth2AuthorizationRequestDto dto = convertToDto(authorizationRequest);
            byte[] jsonBytes = objectMapper.writeValueAsBytes(dto);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(jsonBytes);
        } catch (JacksonException e) {
            throw new IllegalArgumentException("Could not serialize OAuth2AuthorizationRequest", e);
        }
    }

    private OAuth2AuthorizationRequest deserialize(Cookie cookie) {
        try {
            byte[] jsonBytes = Base64.getUrlDecoder().decode(cookie.getValue());
            OAuth2AuthorizationRequestDto dto = objectMapper.readValue(jsonBytes, OAuth2AuthorizationRequestDto.class);
            return convertToRequest(dto);
        } catch (JacksonException | IllegalArgumentException e) {
            return null;
        }
    }

    private OAuth2AuthorizationRequestDto convertToDto(OAuth2AuthorizationRequest request) {
        if (request == null) {
            return null;
        }
        OAuth2AuthorizationRequestDto dto = new OAuth2AuthorizationRequestDto();
        dto.setAuthorizationUri(request.getAuthorizationUri());
        dto.setAuthorizationGrantType(request.getGrantType().getValue());
        dto.setResponseType(request.getResponseType().getValue());
        dto.setClientId(request.getClientId());
        dto.setRedirectUri(request.getRedirectUri());
        dto.setScopes(request.getScopes());
        dto.setState(request.getState());
        dto.setAdditionalParameters(request.getAdditionalParameters());
        dto.setAttributes(request.getAttributes());
        return dto;
    }

    private OAuth2AuthorizationRequest convertToRequest(OAuth2AuthorizationRequestDto dto) {
        if (dto == null) {
            return null;
        }

        // Spring Security 6 client login flow uses authorization code grant type
        OAuth2AuthorizationRequest.Builder builder = OAuth2AuthorizationRequest.authorizationCode();

        return builder
                .authorizationUri(dto.getAuthorizationUri())
                .clientId(dto.getClientId())
                .redirectUri(dto.getRedirectUri())
                .scopes(dto.getScopes())
                .state(dto.getState())
                .additionalParameters(dto.getAdditionalParameters())
                .attributes(dto.getAttributes())
                .build();
    }

    public static class OAuth2AuthorizationRequestDto {
        private String authorizationUri;
        private String authorizationGrantType;
        private String responseType;
        private String clientId;
        private String redirectUri;
        private Set<String> scopes;
        private String state;
        private Map<String, Object> additionalParameters;
        private Map<String, Object> attributes;

        public String getAuthorizationUri() {
            return authorizationUri;
        }

        public void setAuthorizationUri(String authorizationUri) {
            this.authorizationUri = authorizationUri;
        }

        public String getAuthorizationGrantType() {
            return authorizationGrantType;
        }

        public void setAuthorizationGrantType(String authorizationGrantType) {
            this.authorizationGrantType = authorizationGrantType;
        }

        public String getResponseType() {
            return responseType;
        }

        public void setResponseType(String responseType) {
            this.responseType = responseType;
        }

        public String getClientId() {
            return clientId;
        }

        public void setClientId(String clientId) {
            this.clientId = clientId;
        }

        public String getRedirectUri() {
            return redirectUri;
        }

        public void setRedirectUri(String redirectUri) {
            this.redirectUri = redirectUri;
        }

        public Set<String> getScopes() {
            return scopes;
        }

        public void setScopes(Set<String> scopes) {
            this.scopes = scopes;
        }

        public String getState() {
            return state;
        }

        public void setState(String state) {
            this.state = state;
        }

        public Map<String, Object> getAdditionalParameters() {
            return additionalParameters;
        }

        public void setAdditionalParameters(Map<String, Object> additionalParameters) {
            this.additionalParameters = additionalParameters;
        }

        public Map<String, Object> getAttributes() {
            return attributes;
        }

        public void setAttributes(Map<String, Object> attributes) {
            this.attributes = attributes;
        }
    }
}
