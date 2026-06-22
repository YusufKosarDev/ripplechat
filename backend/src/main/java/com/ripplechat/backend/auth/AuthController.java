package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.ActiveSessionResponse;
import com.ripplechat.backend.auth.dto.AuthResponse;
import com.ripplechat.backend.auth.dto.LoginRequest;
import com.ripplechat.backend.auth.dto.RefreshRequest;
import com.ripplechat.backend.auth.dto.RegisterRequest;
import com.ripplechat.backend.auth.dto.TokenResponse;
import com.ripplechat.backend.auth.dto.Verify2FaRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

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
