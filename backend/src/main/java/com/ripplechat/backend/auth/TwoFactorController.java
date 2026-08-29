package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.CodeRequest;
import com.ripplechat.backend.auth.dto.PasswordConfirmRequest;
import com.ripplechat.backend.auth.dto.RecoveryCodesResponse;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ripplechat.backend.redis.RateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/2fa")
@RequiredArgsConstructor
public class TwoFactorController {

    private static final double TWO_FACTOR_BURST = 5;
    private static final double TWO_FACTOR_REFILL_PER_SEC = 0.1;

    private final TwoFactorService twoFactorService;
    private final RecoveryCodeService recoveryCodeService;
    private final UserRepository userRepository;
    private final RateLimiter rateLimiter;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/setup")
    public Map<String, String> setup2Fa(@AuthenticationPrincipal String username,
                                        @RequestBody(required = false) PasswordConfirmRequest request) {
        throttle(username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        requirePassword(user, request == null ? null : request.password());

        if (user.isTwoFactorEnabled()) {
            throw new BadRequestException("2FA is already enabled");
        }

        String secret = twoFactorService.generateNewSecret();
        user.setTotpSecret(secret);
        userRepository.save(user);

        String qrCodeUri = twoFactorService.generateQrCodeImageUri(secret, user.getEmail());
        return Map.of("qrCodeUri", qrCodeUri, "secret", secret);
    }

    @PostMapping("/enable")
    public RecoveryCodesResponse enable2Fa(@AuthenticationPrincipal String username, @Valid @RequestBody CodeRequest request) {
        throttle(username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        requirePassword(user, request.password());

        if (user.isTwoFactorEnabled()) {
            throw new BadRequestException("2FA is already enabled");
        }

        if (user.getTotpSecret() == null) {
            throw new BadRequestException("2FA setup not initialized");
        }

        if (!twoFactorService.isOtpValid(user.getTotpSecret(), request.code())) {
            throw new BadRequestException("Invalid 2FA code");
        }

        user.setTwoFactorEnabled(true);
        userRepository.save(user);
        // Issued once, here — these substitute for a TOTP code if the authenticator
        // is ever lost. Returned now and never retrievable again.
        return new RecoveryCodesResponse(recoveryCodeService.generate(user));
    }

    @PostMapping("/disable")
    public Map<String, Boolean> disable2Fa(@AuthenticationPrincipal String username, @Valid @RequestBody CodeRequest request) {
        throttle(username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        requirePassword(user, request.password());

        if (!user.isTwoFactorEnabled()) {
            throw new BadRequestException("2FA is not enabled");
        }

        if (!twoFactorService.isOtpValid(user.getTotpSecret(), request.code())) {
            throw new BadRequestException("Invalid 2FA code");
        }

        user.setTwoFactorEnabled(false);
        user.setTotpSecret(null);
        userRepository.save(user);
        recoveryCodeService.deleteAll(user);
        return Map.of("success", true);
    }

    /** How many unused recovery codes remain (for a "regenerate" prompt). */
    @GetMapping("/recovery-codes")
    public Map<String, Long> recoveryCodeCount(@AuthenticationPrincipal String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return Map.of("remaining", recoveryCodeService.remaining(user));
    }

    /** Re-issues a fresh batch of recovery codes (invalidating the old ones). Requires a current TOTP code. */
    @PostMapping("/recovery-codes/regenerate")
    public RecoveryCodesResponse regenerateRecoveryCodes(@AuthenticationPrincipal String username,
                                                         @Valid @RequestBody CodeRequest request) {
        throttle(username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        requirePassword(user, request.password());

        if (!user.isTwoFactorEnabled()) {
            throw new BadRequestException("2FA is not enabled");
        }
        if (!twoFactorService.isOtpValid(user.getTotpSecret(), request.code())) {
            throw new BadRequestException("Invalid 2FA code");
        }
        return new RecoveryCodesResponse(recoveryCodeService.generate(user));
    }

    /**
     * Re-confirms the account password before a change to two-factor auth.
     *
     * <p>Without this, an access token was the only thing needed to disable 2FA —
     * so anyone who had stolen a session could strip the second factor off the
     * account, which defeats the point of having it. An account created through
     * Google has no local password, and for those the session is the only
     * credential in existence, so the check does not apply.
     */
    private void requirePassword(User user, String password) {
        if (user.getPassword() == null) {
            return;
        }
        if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new BadRequestException("password is incorrect");
        }
    }

    /** Shared throttle for every 2FA management action. */
    private void throttle(String username) {
        if (!rateLimiter.tryAcquire("2fa-manage:" + username, TWO_FACTOR_BURST, TWO_FACTOR_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many 2FA attempts, please wait a moment and try again");
        }
    }
}
