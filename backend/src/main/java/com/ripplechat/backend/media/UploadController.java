package com.ripplechat.backend.media;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Uploads an image attachment and returns its URL. Authentication is required
 * (enforced by the security config); the URL is then attached to a message.
 */
@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final UploadService uploadService;

    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadImage(@RequestParam("file") MultipartFile file) {
        return Map.of("url", uploadService.uploadImage(file));
    }

    /** Uploads any file (PDF, etc.) for a download-card attachment. */
    @PostMapping(value = "/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadFile(@RequestParam("file") MultipartFile file) {
        String name = file.getOriginalFilename();
        return Map.of("url", uploadService.uploadFile(file), "name", name == null || name.isBlank() ? "dosya" : name);
    }
}
