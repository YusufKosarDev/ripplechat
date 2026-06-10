package com.ripplechat.backend.user;

import com.ripplechat.backend.user.dto.ChangePasswordRequest;
import com.ripplechat.backend.user.dto.UpdateMeRequest;
import com.ripplechat.backend.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Self-service user endpoints. A user may only read and modify their own
 * account (resolved from the authenticated principal) — there are intentionally
 * no by-id endpoints, which would otherwise let any authenticated user read or
 * mutate another account. Cross-user views are exposed elsewhere without PII
 * (e.g. {@code UserSummary} on message senders / channel members).
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal String username) {
        return userService.findByUsername(username);
    }

    @PutMapping("/me")
    public UserResponse updateMe(@RequestBody UpdateMeRequest request,
                                 @AuthenticationPrincipal String username) {
        return userService.updateMe(username, request);
    }

    @PutMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@RequestBody ChangePasswordRequest request,
                               @AuthenticationPrincipal String username) {
        userService.changePassword(username, request);
    }
}
