package com.ripplechat.backend.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Transparently encrypts and decrypts entity attributes at rest using AES-GCM-256.
 *
 * <p>The key comes from {@code app.encryption.secret}, which defaults to
 * {@code jwt.secret}. They were the same value with no way to separate them,
 * which made rotating the JWT signing secret — an ordinary thing to do — quietly
 * destroy every stored TOTP secret, because the old ciphertext could no longer
 * be decrypted. Set {@code app.encryption.secret} explicitly to rotate one
 * without the other; leaving it unset keeps existing data readable.
 *
 * <p>Includes a fallback to raw values for legacy/existing plain text data.
 */
@Converter
@Component
public class EncryptionConverter implements AttributeConverter<String, String> {

    private static final Logger log = LoggerFactory.getLogger(EncryptionConverter.class);

    private final SecretKeySpec secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public EncryptionConverter(@Value("${app.encryption.secret:${jwt.secret}}") String secret) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = sha.digest(secret.getBytes(StandardCharsets.UTF_8));
            this.secretKey = new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize EncryptionConverter", e);
        }
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            byte[] iv = new byte[12];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec parameterSpec = new GCMParameterSpec(128, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);
            byte[] encryptedData = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));

            byte[] message = new byte[12 + encryptedData.length];
            System.arraycopy(iv, 0, message, 0, 12);
            System.arraycopy(encryptedData, 0, message, 12, encryptedData.length);

            return Base64.getEncoder().encodeToString(message);
        } catch (Exception e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        try {
            byte[] message = Base64.getDecoder().decode(dbData);
            if (message.length < 12) {
                return dbData;
            }
            byte[] iv = new byte[12];
            System.arraycopy(message, 0, iv, 0, 12);
            byte[] encryptedData = new byte[message.length - 12];
            System.arraycopy(message, 12, encryptedData, 0, encryptedData.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec parameterSpec = new GCMParameterSpec(128, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);
            byte[] decryptedData = cipher.doFinal(encryptedData);

            return new String(decryptedData, StandardCharsets.UTF_8);
        } catch (Exception e) {
            // Decryption failed. Almost always a legacy plaintext string written
            // before this converter existed — but it is also what a rotated key
            // looks like, and that case used to pass silently, handing the caller
            // base64 ciphertext as though it were the secret. Say so once here so
            // the cause is visible in the logs rather than only as 2FA that has
            // mysteriously stopped accepting codes.
            if (looksLikeCiphertext(dbData)) {
                log.warn("Could not decrypt a stored value — if app.encryption.secret "
                        + "(or jwt.secret) was changed, existing encrypted data is unreadable");
            }
            return dbData;
        }
    }

    /**
     * Whether the stored value looks like something this converter wrote, rather
     * than a plaintext value that predates it: base64 of at least the 12-byte IV
     * plus a 16-byte GCM tag.
     */
    private static boolean looksLikeCiphertext(String dbData) {
        try {
            return Base64.getDecoder().decode(dbData).length >= 28;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
