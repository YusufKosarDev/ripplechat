package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.CodeRequest;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/2fa")
@RequiredArgsConstructor
public class TwoFactorController {

    private final TwoFactorService twoFactorService;
    private final UserRepository userRepository;

    @PostMapping("/setup")
    public Map<String, String> setup2Fa(@AuthenticationPrincipal String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

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
    public Map<String, Boolean> enable2Fa(@AuthenticationPrincipal String username, @Valid @RequestBody CodeRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

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
        return Map.of("success", true);
    }

    @PostMapping("/disable")
    public Map<String, Boolean> disable2Fa(@AuthenticationPrincipal String username, @Valid @RequestBody CodeRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!user.isTwoFactorEnabled()) {
            throw new BadRequestException("2FA is not enabled");
        }

        if (!twoFactorService.isOtpValid(user.getTotpSecret(), request.code())) {
            throw new BadRequestException("Invalid 2FA code");
        }

        user.setTwoFactorEnabled(false);
        user.setTotpSecret(null);
        userRepository.save(user);
        return Map.of("success", true);
    }
}
