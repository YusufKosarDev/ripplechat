package com.ripplechat.backend.e2ee;

import lombok.Data;
import java.util.List;

/** DTO for uploading pre-key bundles from the client. */
@Data
public class PreKeyUploadRequest {
    private int signedPreKeyId;
    private String signedPreKeyPublic;
    private String signedPreKeySignature;
    private List<OneTimePreKeyDto> oneTimePreKeys;

    @Data
    public static class OneTimePreKeyDto {
        private int keyId;
        private String publicKey;
    }
}
