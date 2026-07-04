package com.ripplechat.backend.e2ee;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/** DTO returned when a client fetches another user's pre-key bundle for X3DH. */
@Data
@AllArgsConstructor
public class PreKeyBundleResponse {
    private String identityKey;          // The user's long-term ECDH public key
    private int signedPreKeyId;
    private String signedPreKeyPublic;
    private String signedPreKeySignature;
    private Integer oneTimePreKeyId;     // nullable if none left
    private String oneTimePreKeyPublic;  // nullable if none left
}
