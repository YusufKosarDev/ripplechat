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
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final UserRepository userRepository;

    @Value("${app.frontend.oauth2-redirect-uri:http://localhost:5173/oauth2/redirect}")
    private String redirectUri;

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
        String targetUrl = redirectUriParam.orElse(redirectUri);

        String username = authentication.getName();
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));

        // A disabled (banned) or erased account must not obtain a session through the
        // OAuth2 path either — otherwise "Sign in with Google" would bypass the ban
        // that AuthService.login() enforces. Redirect back with an error, no tokens.
        if (user.isDisabled() || user.isDeleted()) {
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
}
