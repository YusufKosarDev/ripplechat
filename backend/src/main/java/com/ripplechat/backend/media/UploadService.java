package com.ripplechat.backend.media;

import com.ripplechat.backend.common.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
@RequiredArgsConstructor
public class UploadService {

    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024; // 5 MB
    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024; // 10 MB

    private final MediaStorage mediaStorage;

    /** Validates and uploads an image, returning its public URL. */
    public String uploadImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("file is required");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new BadRequestException("image must be at most 5 MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BadRequestException("only image uploads are allowed");
        }
        try {
            return mediaStorage.uploadImage(file.getBytes());
        } catch (IOException e) {
            throw new BadRequestException("could not read the uploaded file");
        }
    }

    /** Validates and uploads any file (≤ 10 MB), returning its public URL. */
    public String uploadFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("file is required");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BadRequestException("file must be at most 10 MB");
        }
        try {
            return mediaStorage.uploadFile(file.getBytes());
        } catch (IOException e) {
            throw new BadRequestException("could not read the uploaded file");
        }
    }
}
