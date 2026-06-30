package com.ripplechat.backend.auth;

import com.ripplechat.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * Issues and consumes 2FA recovery (backup) codes. Codes are shown to the user
 * exactly once, at generation; only their SHA-256 hashes are stored. A code is
 * single-use and substitutes for a TOTP code at the second-factor login step.
 */
@Service
@RequiredArgsConstructor
public class RecoveryCodeService {

    private static final int CODE_COUNT = 10;
    private static final int CODE_LENGTH = 10;
    // Crockford-ish alphabet: no 0/O/1/I/L to avoid transcription mistakes.
    private static final char[] ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789".toCharArray();

    private final RecoveryCodeRepository repository;
    private final SecureRandom random = new SecureRandom();

    /**
     * Replaces any existing codes with a fresh batch and returns the plaintext
     * codes (the only time they are ever available). Each is shown grouped as
     * {@code xxxxx-xxxxx} for readability; storage/verification normalise that away.
     */
    @Transactional
    public List<String> generate(User user) {
        repository.deleteByUser(user);
        List<String> plain = new ArrayList<>(CODE_COUNT);
        for (int i = 0; i < CODE_COUNT; i++) {
            String raw = randomCode();
            RecoveryCode code = new RecoveryCode();
            code.setUser(user);
            code.setCodeHash(hash(normalize(raw)));
            repository.save(code);
            plain.add(format(raw));
        }
        return plain;
    }

    /** Consumes a matching unused code; returns true if the input was a valid code. */
    @Transactional
    public boolean consumeIfValid(User user, String input) {
        if (input == null || input.isBlank()) {
            return false;
        }
        return repository.findByUserAndCodeHashAndUsedFalse(user, hash(normalize(input)))
                .map(code -> {
                    code.setUsed(true);
                    return true;
                })
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public long remaining(User user) {
        return repository.countByUserAndUsedFalse(user);
    }

    @Transactional
    public void deleteAll(User user) {
        repository.deleteByUser(user);
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(ALPHABET[random.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }

    /** Group as xxxxx-xxxxx for display. */
    private String format(String raw) {
        return raw.substring(0, 5) + "-" + raw.substring(5);
    }

    /** Strip formatting and case so the user can type it either way. */
    private String normalize(String code) {
        return code.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
