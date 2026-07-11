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
            byte[] bytes = file.getBytes();
            // A corrupt or mislabelled file used to travel all the way to
            // Cloudinary, whose SDK error surfaced as a 500. Checking the
            // magic bytes here turns that into the 400 it really is (and
            // spares the upload quota). SVG is text-based, so it is exempt.
            if (!"image/svg+xml".equals(contentType) && !looksLikeRasterImage(bytes)) {
                throw new BadRequestException("not a valid image file");
            }
            return mediaStorage.uploadImage(bytes);
        } catch (IOException e) {
            throw new BadRequestException("could not read the uploaded file");
        }
    }

    /** True when the bytes start with a known raster signature (PNG/JPEG/GIF/WebP/BMP). */
    private boolean looksLikeRasterImage(byte[] b) {
        if (b.length < 12) {
            return false;
        }
        boolean png = (b[0] & 0xff) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
        boolean jpeg = (b[0] & 0xff) == 0xff && (b[1] & 0xff) == 0xd8 && (b[2] & 0xff) == 0xff;
        boolean gif = b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8';
        boolean webp = b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
        boolean bmp = b[0] == 'B' && b[1] == 'M';
        return png || jpeg || gif || webp || bmp;
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
