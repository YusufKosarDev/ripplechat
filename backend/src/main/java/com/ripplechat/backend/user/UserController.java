package com.ripplechat.backend.user;

import com.ripplechat.backend.user.dto.ChangePasswordRequest;
import com.ripplechat.backend.user.dto.UpdateMeRequest;
import com.ripplechat.backend.user.dto.UserResponse;
import com.ripplechat.backend.user.dto.UserSummary;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

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
    private final BlockService blockService;

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal String username) {
        return userService.findByUsername(username);
    }

    /** Searches users (no PII) for the direct-message picker; excludes the caller. */
    @GetMapping("/search")
    public List<UserSummary> search(@RequestParam("q") String q,
                                    @AuthenticationPrincipal String username) {
        return userService.search(q, username);
    }

    @PutMapping("/me")
    public UserResponse updateMe(@Valid @RequestBody UpdateMeRequest request,
                                 @AuthenticationPrincipal String username) {
        return userService.updateMe(username, request);
    }

    @PutMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@RequestBody ChangePasswordRequest request,
                               @AuthenticationPrincipal String username) {
        userService.changePassword(username, request);
    }

    /** Users the caller has blocked. */
    @GetMapping("/blocks")
    public List<UserSummary> blocks(@AuthenticationPrincipal String username) {
        return blockService.listBlocked(username);
    }

    @PostMapping("/{userId}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void block(@PathVariable UUID userId, @AuthenticationPrincipal String username) {
        blockService.block(username, userId);
    }

    @DeleteMapping("/{userId}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unblock(@PathVariable UUID userId, @AuthenticationPrincipal String username) {
        blockService.unblock(username, userId);
    }
}
