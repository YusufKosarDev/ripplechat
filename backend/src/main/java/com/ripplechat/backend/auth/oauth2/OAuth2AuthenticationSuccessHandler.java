package com.ripplechat.backend.auth.oauth2;

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
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final UserRepository userRepository;

    @Value("${APP_OAUTH2_REDIRECT_URI:http://localhost:5173/oauth2/redirect}")
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
            URI clientRedirectUri = URI.create(uriStr);
            if (!clientRedirectUri.isAbsolute()) {
                // If relative path, only allow a path starting with a single '/'
                return uriStr.startsWith("/") && !uriStr.startsWith("//");
            }
            if (clientRedirectUri.getHost() == null) {
                return false;
            }

            if (allowedOrigins != null && !allowedOrigins.isBlank()) {
                for (String allowedOrigin : allowedOrigins.split(",")) {
                    try {
                        if (sameOrigin(URI.create(allowedOrigin.trim()), clientRedirectUri)) {
                            return true;
                        }
                    } catch (Exception ignored) {
                        // A malformed entry in the allowlist must not authorise anything.
                    }
                }
            }

            return redirectUri != null && sameOrigin(URI.create(redirectUri), clientRedirectUri);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Full origin comparison: scheme, host and port must all match.
     *
     * <p>The scheme check is the load-bearing part. Comparing only host and port
     * treats {@code http://example.com} as equal to {@code https://example.com}
     * — both report port -1 — so an allowlisted HTTPS origin would also
     * authorise a plaintext redirect, and this URL carries the access and
     * refresh tokens as query parameters.
     */
    private static boolean sameOrigin(URI allowed, URI candidate) {
        return allowed.getHost() != null
                && allowed.getHost().equalsIgnoreCase(candidate.getHost())
                && allowed.getPort() == candidate.getPort()
                && allowed.getScheme() != null
                && allowed.getScheme().equalsIgnoreCase(candidate.getScheme());
    }
}
