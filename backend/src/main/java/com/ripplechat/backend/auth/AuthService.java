package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.AuthResponse;
import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.auth.dto.RegisterRequest;
import com.ripplechat.backend.auth.dto.TokenResponse;
import com.ripplechat.backend.auth.dto.Verify2FaRequest;
import com.ripplechat.backend.auth.dto.ActiveSessionResponse;
import com.ripplechat.backend.redis.RateLimiter;
import com.ripplechat.backend.common.exception.DuplicateResourceException;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import com.ripplechat.backend.user.dto.UserResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.UUID;

@Service
public class AuthService {

    // Login throttle: ~5 attempts burst, then ~1 every 10s per login identifier.
    private static final double LOGIN_BURST = 5;
    private static final double LOGIN_REFILL_PER_SEC = 0.1;

    // The shared public demo account: generous enough that real visitors are
    // never turned away, small enough that it is still metered.
    private static final double DEMO_LOGIN_BURST = 60;
    private static final double DEMO_LOGIN_REFILL_PER_SEC = 1;

    // 2FA code throttle: ~5 attempts burst, then ~1 every 10s per user. Stops a
    // 6-digit TOTP from being brute-forced once the password step has been passed.
    private static final double TWO_FACTOR_BURST = 5;
    private static final double TWO_FACTOR_REFILL_PER_SEC = 0.1;

    /**
     * Registration throttle, keyed by client IP. Default ~5 burst, then ~1 every
     * 30s, which limits automated account-creation spam from one source.
     *
     * <p>Configurable because an IP is not a person: everyone behind one office,
     * school or mobile-carrier NAT shares this budget, so a handful of colleagues
     * signing up together would turn each other away. A deployment that knows its
     * users arrive that way should raise it — and the integration test suite,
     * which creates a dozen accounts from one address, does.
     */
    private final double registerBurst;
    private final double registerRefillPerSec;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final RateLimiter rateLimiter;
    private final SecurityAuditLogger audit;
    private final TwoFactorService twoFactorService;
    private final RecoveryCodeService recoveryCodeService;
    private final AccountService accountService;
    private final LoginLockoutService loginLockoutService;
    private final TokenRevocationService tokenRevocationService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       RefreshTokenService refreshTokenService,
                       RateLimiter rateLimiter,
                       SecurityAuditLogger audit,
                       TwoFactorService twoFactorService,
                       RecoveryCodeService recoveryCodeService,
                       AccountService accountService,
                       LoginLockoutService loginLockoutService,
                       TokenRevocationService tokenRevocationService,
                       @Value("${app.security.register.burst:5}") double registerBurst,
                       @Value("${app.security.register.refill-per-second:0.033}") double registerRefillPerSec) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.rateLimiter = rateLimiter;
        this.audit = audit;
        this.twoFactorService = twoFactorService;
        this.recoveryCodeService = recoveryCodeService;
        this.accountService = accountService;
        this.loginLockoutService = loginLockoutService;
        this.tokenRevocationService = tokenRevocationService;
        this.registerBurst = registerBurst;
        this.registerRefillPerSec = registerRefillPerSec;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        return register(request, null, null);
    }

    @Transactional
    public AuthResponse register(RegisterRequest request, String ipAddress, String userAgent) {
        if (ipAddress != null
                && !rateLimiter.tryAcquire("register:" + ipAddress, registerBurst, registerRefillPerSec)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many registration attempts, please wait a moment and try again");
        }
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
        accountService.sendVerificationEmail(saved);
        String accessToken = jwtService.generateToken(saved.getUsername());
        String refreshToken = refreshTokenService.issue(saved, ipAddress, userAgent);
        return AuthResponse.of(accessToken, refreshToken, UserResponse.from(saved));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        return login(request, null, null);
    }

    @Transactional
    public AuthResponse login(LoginRequest request, String ipAddress, String userAgent) {
        // Brute-force throttle, keyed by the attempted login identifier.
        //
        // The public "demo" account gets a much larger budget rather than none at
        // all: its password is intentionally known, so the normal throttle would
        // block genuine visitors arriving through the one-click demo — but no
        // limit whatsoever made it the one unmetered authentication endpoint in
        // the application.
        String login = request.login();
        boolean isDemo = "demo".equalsIgnoreCase(login.trim());
        double burst = isDemo ? DEMO_LOGIN_BURST : LOGIN_BURST;
        double refill = isDemo ? DEMO_LOGIN_REFILL_PER_SEC : LOGIN_REFILL_PER_SEC;
        if (!rateLimiter.tryAcquire("login:" + login.toLowerCase(), burst, refill)) {
            audit.loginThrottled(login);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many login attempts, please wait a moment and try again");
        }

        // Username first, then email — deterministically, one row at a time.
        // findByUsernameOrEmail(login, login) returns an Optional, so if a
        // username ever collided with someone else's email address the query
        // matched two rows and threw, making that person's email sign-in fail
        // outright. The username charset now rules the collision out; resolving
        // in a defined order means existing data cannot trip over it either.
        User user = userRepository.findByUsername(login)
                .or(() -> userRepository.findByEmail(login))
                .orElse(null);
        if (user == null || user.isDeleted()) {
            // A deleted account is treated exactly like an unknown one (its
            // credentials are scrubbed anyway) — no signal that it ever existed.
            audit.loginFailed(login, "unknown_account");
            throw new InvalidCredentialsException("invalid username/email or password");
        }

        // Temporary account lockout after repeated failures (keyed on the resolved
        // username, so username and email attempts count together). Auto-unlocks.
        if (!isDemo && loginLockoutService.isLocked(user.getUsername())) {
            audit.loginBlockedWhileLocked(user.getUsername());
            throw new ResponseStatusException(HttpStatus.LOCKED,
                    "account temporarily locked after too many failed attempts; please try again later");
        }

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            if (!isDemo) {
                loginLockoutService.recordFailure(user.getUsername());
            }
            audit.loginFailed(login, "bad_password");
            throw new InvalidCredentialsException("invalid username/email or password");
        }

        // Correct password: clear any failed-attempt state (even if 2FA is pending).
        if (!isDemo) {
            loginLockoutService.reset(user.getUsername());
        }

        // Banned by an admin. Checked only *after* the password verifies, so an
        // unauthenticated caller can't probe whether an account exists or is banned
        // (same username-enumeration guard the deleted-account branch upholds).
        if (user.isDisabled()) {
            audit.loginFailed(user.getUsername(), "account_disabled");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "this account has been disabled");
        }

        if (user.isTwoFactorEnabled()) {
            audit.loginSucceeded(user.getUsername() + " (pre-auth 2FA)");
            String preAuthToken = jwtService.generatePreAuthToken(user.getUsername());
            return AuthResponse.requires2Fa(preAuthToken);
        }

        audit.loginSucceeded(user.getUsername());
        String accessToken = jwtService.generateToken(user.getUsername());
        String refreshToken = refreshTokenService.issue(user, ipAddress, userAgent);
        return AuthResponse.of(accessToken, refreshToken, UserResponse.from(user));
    }

    @Transactional
    public AuthResponse verify2FaLogin(Verify2FaRequest request) {
        return verify2FaLogin(request, null, null);
    }

    @Transactional
    public AuthResponse verify2FaLogin(Verify2FaRequest request, String ipAddress, String userAgent) {
        String username = jwtService.extractUsernameFromPreAuthToken(request.preAuthToken());
        if (!rateLimiter.tryAcquire("2fa:" + username, TWO_FACTOR_BURST, TWO_FACTOR_REFILL_PER_SEC)) {
            audit.loginThrottled(username);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many 2FA attempts, please wait a moment and try again");
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid token"));

        // Guard the second login leg too: an account disabled (or erased) after the
        // password step — while the pre-auth token was still valid — must not be able
        // to finish signing in by submitting a 2FA code.
        if (!user.canAuthenticate()) {
            audit.loginFailed(username, "account_disabled");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "this account has been disabled");
        }

        if (!user.isTwoFactorEnabled()) {
            throw new InvalidCredentialsException("2FA is not enabled for this user");
        }

        // Accept either a current TOTP code or a single-use recovery code (for a
        // user who has lost their authenticator). Recovery codes are consumed on use.
        boolean otpValid = twoFactorService.isOtpValid(user.getTotpSecret(), request.code());
        if (!otpValid && !recoveryCodeService.consumeIfValid(user, request.code())) {
            audit.loginFailed(username, "bad_2fa_code");
            throw new InvalidCredentialsException("Invalid 2FA code");
        }

        audit.loginSucceeded(username + " (2FA passed)");
        String accessToken = jwtService.generateToken(user.getUsername());
        String refreshToken = refreshTokenService.issue(user, ipAddress, userAgent);
        return AuthResponse.of(accessToken, refreshToken, UserResponse.from(user));
    }

    @Transactional
    public TokenResponse refresh(String refreshToken) {
        return refresh(refreshToken, null, null);
    }

    /**
     * Renews the access token from a valid refresh token, rotating the refresh
     * token (the presented one is invalidated). Throws if it is unknown,
     * expired or revoked.
     */
    @Transactional
    public TokenResponse refresh(String refreshToken, String ipAddress, String userAgent) {
        User user;
        try {
            user = refreshTokenService.rotate(refreshToken);
        } catch (RuntimeException e) {
            audit.refreshRejected();
            throw e;
        }
        audit.tokenRefreshed(user.getUsername());
        String accessToken = jwtService.generateToken(user.getUsername());
        String newRefreshToken = refreshTokenService.issue(user, ipAddress, userAgent);
        return TokenResponse.of(accessToken, newRefreshToken);
    }

    /**
     * Ends the session: drops the refresh token so it can no longer renew, and
     * voids the access tokens already issued. Dropping the refresh token alone
     * left the access token working for the rest of its hour, which is not what
     * anyone means by signing out.
     */
    @Transactional
    public void logout(String refreshToken) {
        refreshTokenService.revoke(refreshToken)
                .ifPresent(user -> tokenRevocationService.revokeBefore(user.getUsername()));
        audit.loggedOut();
    }

    @Transactional(readOnly = true)
    public List<ActiveSessionResponse> getActiveSessions(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return refreshTokenService.getActiveSessions(user).stream()
                .map(ActiveSessionResponse::from)
                .toList();
    }

    /**
     * Signs another device out. The watermark is per-user, so this also voids the
     * caller's own access token — harmless, because their refresh token survives
     * and the client renews transparently on the next 401. The revoked device
     * cannot: its refresh token is gone.
     */
    @Transactional
    public void revokeSession(String username, UUID sessionId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        refreshTokenService.revokeSession(user, sessionId);
        tokenRevocationService.revokeBefore(username);
    }
}
