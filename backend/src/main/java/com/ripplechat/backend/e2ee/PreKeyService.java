package com.ripplechat.backend.e2ee;

import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PreKeyService {

    private final SignedPreKeyRepository signedPreKeyRepository;
    private final OneTimePreKeyRepository oneTimePreKeyRepository;
    private final UserRepository userRepository;

    /**
     * Stores (or replaces) a user's signed pre-key and appends one-time pre-keys.
     */
    @Transactional
    public void uploadPreKeys(String username, PreKeyUploadRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Replace signed pre-key
        signedPreKeyRepository.deleteAllByUserId(user.getId());
        SignedPreKey spk = new SignedPreKey();
        spk.setUserId(user.getId());
        spk.setKeyId(request.getSignedPreKeyId());
        spk.setPublicKey(request.getSignedPreKeyPublic());
        spk.setSignature(request.getSignedPreKeySignature());
        signedPreKeyRepository.save(spk);

        // Append one-time pre-keys
        if (request.getOneTimePreKeys() != null) {
            for (PreKeyUploadRequest.OneTimePreKeyDto otpk : request.getOneTimePreKeys()) {
                OneTimePreKey entity = new OneTimePreKey();
                entity.setUserId(user.getId());
                entity.setKeyId(otpk.getKeyId());
                entity.setPublicKey(otpk.getPublicKey());
                oneTimePreKeyRepository.save(entity);
            }
        }

        log.info("Uploaded pre-keys for user {} (signed={}, oneTime={})",
                username, request.getSignedPreKeyId(),
                request.getOneTimePreKeys() != null ? request.getOneTimePreKeys().size() : 0);
    }

    /**
     * Returns a pre-key bundle for the given user ID. If a one-time pre-key is
     * available, it is consumed (deleted) atomically — this is the Signal model.
     */
    @Transactional
    public PreKeyBundleResponse getPreKeyBundle(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        SignedPreKey spk = signedPreKeyRepository.findTopByUserIdOrderByCreatedAtDesc(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "User has not uploaded pre-keys yet"));

        // Consume one OTP key (if available)
        Integer otpKeyId = null;
        String otpKeyPublic = null;
        var otpKey = oneTimePreKeyRepository.findTopByUserIdOrderByKeyIdAsc(userId);
        if (otpKey.isPresent()) {
            otpKeyId = otpKey.get().getKeyId();
            otpKeyPublic = otpKey.get().getPublicKey();
            oneTimePreKeyRepository.delete(otpKey.get());
        }

        return new PreKeyBundleResponse(
                user.getPublicKey(),    // identity key
                spk.getKeyId(),
                spk.getPublicKey(),
                spk.getSignature(),
                otpKeyId,
                otpKeyPublic
        );
    }

    /** Returns remaining one-time pre-key count for the authenticated user. */
    public long countOneTimePreKeys(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return oneTimePreKeyRepository.countByUserId(user.getId());
    }
}
