package com.ripplechat.backend.media;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

import java.io.IOException;
import java.util.Map;

/** Cloudinary-backed media storage. Active when CLOUDINARY_URL is configured. */
public class CloudinaryMediaStorage implements MediaStorage {

    // Bound the outbound upload so a slow/unresponsive Cloudinary can't hold a
    // request thread indefinitely (the SDK otherwise waits far longer).
    private static final int UPLOAD_TIMEOUT_MS = 15_000;

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
                    .upload(bytes, ObjectUtils.asMap(
                            "folder", "ripplechat",
                            "resource_type", resourceType,
                            "timeout", UPLOAD_TIMEOUT_MS));
            return (String) result.get("secure_url");
        } catch (IOException e) {
            throw new IllegalStateException("upload failed", e);
        }
    }

    @Override
    public boolean delete(String url) {
        if (url == null || !url.startsWith("https://res.cloudinary.com/")) {
            return false;
        }
        try {
            int uploadIndex = url.indexOf("/upload/");
            if (uploadIndex == -1) {
                return false;
            }
            String beforeUpload = url.substring(0, uploadIndex);
            String resourceType = beforeUpload.substring(beforeUpload.lastIndexOf('/') + 1);
            String afterUpload = url.substring(uploadIndex + "/upload/".length());
            if (afterUpload.startsWith("v")) {
                int firstSlash = afterUpload.indexOf('/');
                if (firstSlash != -1) {
                    afterUpload = afterUpload.substring(firstSlash + 1);
                }
            }
            String publicId = afterUpload;
            if ("image".equals(resourceType) || "video".equals(resourceType)) {
                int lastDot = publicId.lastIndexOf('.');
                if (lastDot != -1) {
                    publicId = publicId.substring(0, lastDot);
                }
            }
            Map<?, ?> result = cloudinary.uploader().destroy(publicId, ObjectUtils.asMap(
                    "resource_type", resourceType,
                    "invalidate", true
            ));
            String status = (String) result.get("result");
            return "ok".equals(status) || "not_found".equals(status);
        } catch (Exception e) {
            return false;
        }
    }
}
