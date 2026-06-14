package com.ripplechat.backend.link;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/link-preview")
@RequiredArgsConstructor
public class LinkPreviewController {

    private final LinkPreviewService linkPreviewService;

    /** Returns the preview for a URL, or 204 when none could be built. */
    @GetMapping
    public ResponseEntity<LinkPreview> preview(@RequestParam("url") String url) {
        LinkPreview preview = linkPreviewService.preview(url);
        return preview == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(preview);
    }
}
