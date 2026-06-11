package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.AuthResponse;
import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.auth.dto.RegisterRequest;
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
    private final RateLimiter rateLimiter;

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
        String token = jwtService.generateToken(saved.getUsername());
        return AuthResponse.bearer(token, UserResponse.from(saved));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        // Brute-force throttle, keyed by the attempted login identifier. The
        // public "demo" account is exempt — its password is intentionally known,
        // so throttling it would only block the one-click demo for real visitors.
        boolean isDemo = "demo".equalsIgnoreCase(request.login().trim());
        if (!isDemo && !rateLimiter.tryAcquire("login:" + request.login().toLowerCase(), LOGIN_BURST, LOGIN_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many login attempts, please wait a moment and try again");
        }

        User user = userRepository.findByUsernameOrEmail(request.login(), request.login())
                .orElseThrow(() -> new InvalidCredentialsException("invalid username/email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new InvalidCredentialsException("invalid username/email or password");
        }

        String token = jwtService.generateToken(user.getUsername());
        return AuthResponse.bearer(token, UserResponse.from(user));
    }
}
