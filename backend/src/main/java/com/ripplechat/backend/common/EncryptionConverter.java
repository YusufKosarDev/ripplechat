package com.ripplechat.backend.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
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
 * The key is derived from the jwt.secret value.
 * Includes a graceful fallback to raw values for legacy/existing plain text data.
 */
@Converter
@Component
public class EncryptionConverter implements AttributeConverter<String, String> {

    private final SecretKeySpec secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public EncryptionConverter(@Value("${jwt.secret}") String secret) {
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
            // Decryption failed: probably a legacy plaintext string
            return dbData;
        }
    }
}
