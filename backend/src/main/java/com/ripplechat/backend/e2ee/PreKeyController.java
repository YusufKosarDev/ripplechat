package com.ripplechat.backend.e2ee;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST endpoints for X3DH pre-key management.
 * Clients upload signed + one-time pre-keys after login, and fetch
 * another user's pre-key bundle before initiating a Double Ratchet session.
 */
@RestController
@RequestMapping("/api/e2ee")
@RequiredArgsConstructor
public class PreKeyController {

    private final PreKeyService preKeyService;
    private final GroupCryptoService groupCryptoService;

    /** Upload (replace) signed pre-key and append one-time pre-keys. */
    @PostMapping("/keys")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void uploadPreKeys(@RequestBody PreKeyUploadRequest request,
                              @AuthenticationPrincipal String username) {
        preKeyService.uploadPreKeys(username, request);
    }

    /** Fetch a user's pre-key bundle for X3DH. Consumes one OTP key atomically. */
    @GetMapping("/keys/{userId}")
    public PreKeyBundleResponse getPreKeyBundle(@PathVariable UUID userId) {
        return preKeyService.getPreKeyBundle(userId);
    }

    /** Check how many one-time pre-keys remain (client replenishes when low). */
    @GetMapping("/keys/count")
    public Map<String, Long> countKeys(@AuthenticationPrincipal String username) {
        return Map.of("oneTimePreKeyCount", preKeyService.countOneTimePreKeys(username));
    }

    @PostMapping("/group-keys/{channelId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void uploadGroupKeys(@PathVariable UUID channelId,
                                @RequestBody List<Map<String, String>> request,
                                @AuthenticationPrincipal String username) {
        groupCryptoService.uploadGroupKeys(username, channelId, request);
    }

    @GetMapping("/group-keys/{channelId}")
    public List<Map<String, Object>> getGroupKeys(@PathVariable UUID channelId,
                                                  @AuthenticationPrincipal String username) {
        return groupCryptoService.getGroupKeysForChannel(username, channelId).stream()
                .map(key -> Map.of(
                        "senderId", (Object) key.getSenderId(),
                        "encryptedKey", (Object) key.getEncryptedKey()
                ))
                .toList();
    }
}
