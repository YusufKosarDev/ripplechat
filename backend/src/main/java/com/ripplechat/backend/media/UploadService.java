package com.ripplechat.backend.media;

import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.redis.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UploadService {

    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024; // 5 MB
    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024; // 10 MB

    // Uploads cost storage and bandwidth on someone else's bill, so bound them
    // per user: ~10 burst, then one every five seconds.
    private static final double UPLOAD_BURST = 10;
    private static final double UPLOAD_REFILL_PER_SEC = 0.2;

    /**
     * Content types a browser treats as executable rather than as a download.
     *
     * <p>An allow-list would be the stronger check, but it cannot work here: an
     * end-to-end encrypted attachment is uploaded as opaque
     * {@code application/octet-stream} ciphertext by design, so arbitrary bytes
     * have to be accepted. What must not be accepted is a type that makes the
     * media host render the upload as active content — the part with a security
     * consequence. Everything else is inert: the browser downloads it.
     */
    private static final Set<String> ACTIVE_CONTENT_TYPES = Set.of(
            "text/html",
            "application/xhtml+xml",
            "application/xml",
            "text/xml",
            "image/svg+xml",
            "application/javascript",
            "text/javascript",
            "application/x-httpd-php",
            "text/x-php");

    private final MediaStorage mediaStorage;
    private final RateLimiter rateLimiter;

    /** Validates and uploads an image, returning its public URL. */
    public String uploadImage(String username, MultipartFile file) {
        throttle(username);
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
        // SVG is a script container, not a picture: it was exempted from the
        // magic-byte check because it is text, which also meant it was the one
        // "image" that could carry active content to the media host.
        if ("image/svg+xml".equals(contentType)) {
            throw new BadRequestException("SVG images are not supported");
        }
        try {
            byte[] bytes = file.getBytes();
            // A corrupt or mislabelled file used to travel all the way to
            // Cloudinary, whose SDK error surfaced as a 500. Checking the
            // magic bytes here turns that into the 400 it really is (and
            // spares the upload quota).
            if (!looksLikeRasterImage(bytes)) {
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

    /** Validates and uploads a document or media file (≤ 10 MB), returning its public URL. */
    public String uploadFile(String username, MultipartFile file) {
        throttle(username);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("file is required");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BadRequestException("file must be at most 10 MB");
        }
        String contentType = file.getContentType();
        String baseType = contentType == null ? "" : contentType.split(";")[0].trim().toLowerCase();
        if (ACTIVE_CONTENT_TYPES.contains(baseType)) {
            throw new BadRequestException("this file type is not allowed");
        }
        try {
            return mediaStorage.uploadFile(file.getBytes());
        } catch (IOException e) {
            throw new BadRequestException("could not read the uploaded file");
        }
    }

    private void throttle(String username) {
        if (!rateLimiter.tryAcquire("upload:" + username, UPLOAD_BURST, UPLOAD_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many uploads, please wait a moment and try again");
        }
    }
}
