package com.ripplechat.backend.e2ee;

import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.redis.RateLimiter;
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

    /**
     * One-time pre-keys are consumed by whoever asks for a bundle, so fetching
     * is an act of consumption: ~30 burst, then ~1/s per caller. Without this a
     * single user could drain everyone else's supply in a loop and force every
     * new conversation with them down to the weaker, no-OTPK path.
     */
    private static final double BUNDLE_BURST = 30;
    private static final double BUNDLE_REFILL_PER_SEC = 1;

    /** Clients upload 20 at a time; cap the batch so the table cannot be flooded. */
    private static final int MAX_ONE_TIME_PRE_KEYS = 100;

    private final SignedPreKeyRepository signedPreKeyRepository;
    private final OneTimePreKeyRepository oneTimePreKeyRepository;
    private final UserRepository userRepository;
    private final RateLimiter rateLimiter;

    /**
     * Stores (or replaces) a user's signed pre-key and appends one-time pre-keys.
     */
    @Transactional
    public void uploadPreKeys(String username, PreKeyUploadRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (request.getOneTimePreKeys() != null && request.getOneTimePreKeys().size() > MAX_ONE_TIME_PRE_KEYS) {
            throw new BadRequestException("at most " + MAX_ONE_TIME_PRE_KEYS + " one-time pre-keys per upload");
        }

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
     *
     * <p>Throttled per caller, because "consumed" makes an unauthenticated-shaped
     * read into a write on someone else's key supply.
     */
    @Transactional
    public PreKeyBundleResponse getPreKeyBundle(String callerUsername, UUID userId) {
        if (!rateLimiter.tryAcquire("prekey:" + callerUsername, BUNDLE_BURST, BUNDLE_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many pre-key requests, please wait a moment and try again");
        }
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
