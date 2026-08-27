package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.ActiveSessionResponse;
import com.ripplechat.backend.auth.dto.AuthResponse;
import com.ripplechat.backend.auth.dto.ForgotPasswordRequest;
import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.auth.dto.RefreshRequest;
import com.ripplechat.backend.auth.dto.RegisterRequest;
import com.ripplechat.backend.auth.dto.ResetPasswordRequest;
import com.ripplechat.backend.auth.dto.TokenResponse;
import com.ripplechat.backend.auth.dto.Verify2FaRequest;
import com.ripplechat.backend.auth.dto.VerifyEmailRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AccountService accountService;
    private final String googleClientId;

    // Explicit constructor rather than @RequiredArgsConstructor: Lombok does not
    // copy @Value onto the generated parameter, so the property would not be
    // injected. Same shape as JwtService and AdminBootstrap.
    public AuthController(AuthService authService,
                          AccountService accountService,
                          @Value("${spring.security.oauth2.client.registration.google.client-id:placeholder}")
                          String googleClientId) {
        this.authService = authService;
        this.accountService = accountService;
        this.googleClientId = googleClientId;
    }

    /**
     * Which social sign-in providers are actually usable. Google ships with a
     * placeholder client-id so the registration always exists; the frontend
     * uses this flag to hide the button when clicking it could only fail —
     * the same graceful-enable contract as {@code /api/push/key}.
     */
    @GetMapping("/providers")
    public Map<String, Boolean> providers() {
        boolean googleConfigured = !googleClientId.isBlank() && !"placeholder".equals(googleClientId);
        return Map.of("google", googleConfigured);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        return authService.register(request, getClientIp(httpRequest), getUserAgent(httpRequest));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        return authService.login(request, getClientIp(httpRequest), getUserAgent(httpRequest));
    }

    @PostMapping("/2fa/verify")
    public AuthResponse verify2Fa(@Valid @RequestBody Verify2FaRequest request, HttpServletRequest httpRequest) {
        return authService.verify2FaLogin(request, getClientIp(httpRequest), getUserAgent(httpRequest));
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest request, HttpServletRequest httpRequest) {
        return authService.refresh(request.refreshToken(), getClientIp(httpRequest), getUserAgent(httpRequest));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest request) {
        authService.logout(request.refreshToken());
    }

    /** Starts a password reset; always 204 so it can't reveal whether an email exists. */
    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forgotPassword(@Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest httpRequest) {
        accountService.requestPasswordReset(request.email(), getClientIp(httpRequest));
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        accountService.resetPassword(request.token(), request.newPassword());
    }

    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        accountService.verifyEmail(request.token());
    }

    /** Re-sends the verification email to the signed-in user. */
    @PostMapping("/resend-verification")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification(@AuthenticationPrincipal String username) {
        // /api/auth/** is permit-all, so an unauthenticated caller has a null
        // principal here; require a real session for this one.
        if (username == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "authentication required");
        }
        accountService.resendVerification(username);
    }

    @GetMapping("/sessions")
    public List<ActiveSessionResponse> getSessions(@AuthenticationPrincipal String username) {
        return authService.getActiveSessions(username);
    }

    @DeleteMapping("/sessions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSession(@AuthenticationPrincipal String username, @PathVariable UUID id) {
        authService.revokeSession(username, id);
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            ip = xff.split(",")[0].trim();
        }
        return ip;
    }

    private String getUserAgent(HttpServletRequest request) {
        return request.getHeader("User-Agent");
    }
}
