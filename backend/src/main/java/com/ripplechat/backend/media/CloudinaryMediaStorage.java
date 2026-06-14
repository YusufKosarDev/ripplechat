package com.ripplechat.backend.media;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

import java.io.IOException;
import java.util.Map;

/** Cloudinary-backed media storage. Active when CLOUDINARY_URL is configured. */
public class CloudinaryMediaStorage implements MediaStorage {

    private final Cloudinary cloudinary;

    public CloudinaryMediaStorage(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public String uploadImage(byte[] bytes) {
        return upload(bytes, "image");
    }

    @Override
    public String uploadFile(byte[] bytes) {
        return upload(bytes, "auto");
    }

    private String upload(byte[] bytes, String resourceType) {
        try {
            Map<?, ?> result = cloudinary.uploader()
                    .upload(bytes, ObjectUtils.asMap("folder", "ripplechat", "resource_type", resourceType));
            return (String) result.get("secure_url");
        } catch (IOException e) {
            throw new IllegalStateException("upload failed", e);
        }
    }
}
