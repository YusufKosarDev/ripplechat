package com.ripplechat.backend.media;

/**
 * Stores uploaded media and returns a public URL. Backed by Cloudinary when
 * configured; a disabled no-op otherwise (so the app runs without credentials).
 */
public interface MediaStorage {

    /** Uploads image bytes and returns the public (secure) URL. */
    String uploadImage(byte[] bytes);

    /** Uploads arbitrary file bytes (auto-detected) and returns the public URL. */
    String uploadFile(byte[] bytes);

    /** Whether uploads are configured and available. */
    boolean isEnabled();
}
