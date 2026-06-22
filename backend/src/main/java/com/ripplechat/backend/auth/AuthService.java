package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.AuthResponse;
import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.auth.dto.RegisterRequest;
import com.ripplechat.backend.auth.dto.TokenResponse;
import com.ripplechat.backend.auth.dto.Verify2FaRequest;
import com.ripplechat.backend.common.RateLimiter;
import com.ripplechat.backend.common.exception.DuplicateResourceException;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import com.ripplechat.backend.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    // Login throttle: ~5 attempts burst, then ~1 every 10s per login identifier.
    private static final double LOGIN_BURST = 5;
    private static final double LOGIN_REFILL_PER_SEC = 0.1;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final RateLimiter rateLimiter;
    private final SecurityAuditLogger audit;
    private final TwoFactorService twoFactorService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new DuplicateResourceException("username already taken: " + request.username());
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new DuplicateResourceException("email already registered: " + request.email());
        }

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setDisplayName(request.displayName());
        user.setPassword(passwordEncoder.encode(request.password()));

        User saved = userRepository.saveAndFlush(user);
        audit.registered(saved.getUsername());
        String accessToken = jwtService.generateToken(saved.getUsername());
        String refreshToken = refreshTokenService.issue(saved);
        return AuthResponse.of(accessToken, refreshToken, UserResponse.from(saved));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        // Brute-force throttle, keyed by the attempted login identifier. The
        // public "demo" account is exempt — its password is intentionally known,
        // so throttling it would only block the one-click demo for real visitors.
        String login = request.login();
        boolean isDemo = "demo".equalsIgnoreCase(login.trim());
        if (!isDemo && !rateLimiter.tryAcquire("login:" + login.toLowerCase(), LOGIN_BURST, LOGIN_REFILL_PER_SEC)) {
            audit.loginThrottled(login);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many login attempts, please wait a moment and try again");
        }

        User user = userRepository.findByUsernameOrEmail(login, login).orElse(null);
        if (user == null) {
            audit.loginFailed(login, "unknown_account");
            throw new InvalidCredentialsException("invalid username/email or password");
        }
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            audit.loginFailed(login, "bad_password");
            throw new InvalidCredentialsException("invalid username/email or password");
        }

        if (user.isTwoFactorEnabled()) {
            audit.loginSucceeded(user.getUsername() + " (pre-auth 2FA)");
            String preAuthToken = jwtService.generatePreAuthToken(user.getUsername());
            return AuthResponse.requires2Fa(preAuthToken);
        }

        audit.loginSucceeded(user.getUsername());
        String accessToken = jwtService.generateToken(user.getUsername());
        String refreshToken = refreshTokenService.issue(user);
        return AuthResponse.of(accessToken, refreshToken, UserResponse.from(user));
    }

    @Transactional
    public AuthResponse verify2FaLogin(Verify2FaRequest request) {
        String username = jwtService.extractUsernameFromPreAuthToken(request.preAuthToken());
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid token"));

        if (!user.isTwoFactorEnabled()) {
            throw new InvalidCredentialsException("2FA is not enabled for this user");
        }

        if (!twoFactorService.isOtpValid(user.getTotpSecret(), request.code())) {
            audit.loginFailed(username, "bad_2fa_code");
            throw new InvalidCredentialsException("Invalid 2FA code");
        }

        audit.loginSucceeded(username + " (2FA passed)");
        String accessToken = jwtService.generateToken(user.getUsername());
        String refreshToken = refreshTokenService.issue(user);
        return AuthResponse.of(accessToken, refreshToken, UserResponse.from(user));
    }

    /**
     * Renews the access token from a valid refresh token, rotating the refresh
     * token (the presented one is invalidated). Throws if it is unknown,
     * expired or revoked.
     */
    @Transactional
    public TokenResponse refresh(String refreshToken) {
        User user;
        try {
            user = refreshTokenService.rotate(refreshToken);
        } catch (RuntimeException e) {
            audit.refreshRejected();
            throw e;
        }
        audit.tokenRefreshed(user.getUsername());
        String accessToken = jwtService.generateToken(user.getUsername());
        String newRefreshToken = refreshTokenService.issue(user);
        return TokenResponse.of(accessToken, newRefreshToken);
    }

    /** Revokes the refresh token so it can no longer renew a session (logout). */
    @Transactional
    public void logout(String refreshToken) {
        refreshTokenService.revoke(refreshToken);
        audit.loggedOut();
    }
}
