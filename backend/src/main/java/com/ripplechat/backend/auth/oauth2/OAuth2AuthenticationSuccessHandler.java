package com.ripplechat.backend.auth.oauth2;

import com.ripplechat.backend.auth.AuthService;
import com.ripplechat.backend.auth.JwtService;
import com.ripplechat.backend.auth.RefreshToken;
import com.ripplechat.backend.auth.RefreshTokenService;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final UserRepository userRepository;

    @Value("${app.frontend.oauth2-redirect-uri:http://localhost:5173/oauth2/redirect}")
    private String redirectUri;

    @Value("${app.allowed-origins:}")
    private String allowedOrigins;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        String targetUrl = determineTargetUrl(request, response, authentication);

        if (response.isCommitted()) {
            logger.debug("Response has already been committed. Unable to redirect to " + targetUrl);
            return;
        }

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    protected String determineTargetUrl(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        Optional<String> redirectUriParam = Optional.ofNullable(request.getParameter("redirect_uri"));
        String targetUrl = redirectUriParam
                .filter(this::isAuthorizedRedirectUri)
                .orElse(redirectUri);

        String username = authentication.getName();
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));

        // A disabled (banned) or erased account must not obtain a session through the
        // OAuth2 path either — otherwise "Sign in with Google" would bypass the ban
        // that AuthService.login() enforces. Redirect back with an error, no tokens.
        if (!user.canAuthenticate()) {
            return UriComponentsBuilder.fromUriString(targetUrl)
                    .queryParam("error", "account_disabled")
                    .build().toUriString();
        }

        String accessToken = jwtService.generateToken(username);

        String ipAddress = request.getRemoteAddr();
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            ipAddress = xForwardedFor.split(",")[0].trim();
        }
        String userAgent = request.getHeader("User-Agent");
        String rawRefreshToken = refreshTokenService.issue(user, ipAddress, userAgent);

        return UriComponentsBuilder.fromUriString(targetUrl)
                .queryParam("accessToken", accessToken)
                .queryParam("refreshToken", rawRefreshToken)
                .build().toUriString();
    }

    private boolean isAuthorizedRedirectUri(String uriStr) {
        if (uriStr == null || uriStr.isBlank()) {
            return false;
        }
        try {
            // Prevent open redirect via protocol-relative or backslash-based paths.
            if (uriStr.startsWith("//") || uriStr.startsWith("\\\\") || uriStr.contains("\\")) {
                return false;
            }
            java.net.URI clientRedirectUri = java.net.URI.create(uriStr);
            if (!clientRedirectUri.isAbsolute()) {
                // If relative path, only allow a path starting with a single '/'
                return uriStr.startsWith("/") && !uriStr.startsWith("//");
            }
            String host = clientRedirectUri.getHost();
            int port = clientRedirectUri.getPort();
            if (host == null) {
                return false;
            }

            if (allowedOrigins != null && !allowedOrigins.isBlank()) {
                for (String allowedOrigin : allowedOrigins.split(",")) {
                    try {
                        java.net.URI allowedUri = java.net.URI.create(allowedOrigin.trim());
                        String allowedHost = allowedUri.getHost();
                        int allowedPort = allowedUri.getPort();
                        if (allowedHost != null && allowedHost.equalsIgnoreCase(host) && allowedPort == port) {
                            return true;
                        }
                    } catch (Exception ignored) {}
                }
            }

            if (redirectUri != null) {
                java.net.URI defaultUri = java.net.URI.create(redirectUri);
                String defaultHost = defaultUri.getHost();
                int defaultPort = defaultUri.getPort();
                if (defaultHost != null && defaultHost.equalsIgnoreCase(host) && defaultPort == port) {
                    return true;
                }
            }

            return false;
        } catch (Exception e) {
            return false;
        }
    }
}
