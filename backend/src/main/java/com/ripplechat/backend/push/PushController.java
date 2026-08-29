package com.ripplechat.backend.push;

import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.push.dto.PushSubscriptionRequest;
import com.ripplechat.backend.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final WebPushService webPushService;
    private final UserRepository userRepository;

    /** The VAPID public key the client needs to subscribe (and whether push is on). */
    @GetMapping("/key")
    public Map<String, Object> key() {
        return Map.of("enabled", webPushService.isEnabled(), "publicKey", webPushService.publicKey());
    }

    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(@Valid @RequestBody PushSubscriptionRequest request,
                          @AuthenticationPrincipal String username) {
        var user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        webPushService.subscribe(user.getId(), request.endpoint(), request.p256dh(), request.auth());
    }

    /** Unregisters this browser. Only the account that registered it may. */
    @DeleteMapping("/subscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@RequestParam("endpoint") String endpoint,
                            @AuthenticationPrincipal String username) {
        var user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
        webPushService.unsubscribe(user.getId(), endpoint);
    }
}
