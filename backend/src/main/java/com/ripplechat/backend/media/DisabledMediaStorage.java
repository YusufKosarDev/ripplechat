package com.ripplechat.backend.media;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Fallback used when no storage is configured; uploads return 503. */
public class DisabledMediaStorage implements MediaStorage {

    @Override
    public boolean isEnabled() {
        return false;
    }

    @Override
    public String uploadImage(byte[] bytes) {
        throw disabled();
    }

    @Override
    public String uploadFile(byte[] bytes) {
        throw disabled();
    }

    private ResponseStatusException disabled() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "uploads are not configured");
    }
}
