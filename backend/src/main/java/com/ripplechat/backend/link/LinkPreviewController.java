package com.ripplechat.backend.link;

import com.ripplechat.backend.redis.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/link-preview")
@RequiredArgsConstructor
public class LinkPreviewController {

    // Each call can make the server fetch an arbitrary page. The cache blunts
    // repeats, but a caller who varies the URL bypasses it — so bound the rate:
    // ~20 burst, then one every two seconds.
    private static final double PREVIEW_BURST = 20;
    private static final double PREVIEW_REFILL_PER_SEC = 0.5;

    private final LinkPreviewService linkPreviewService;
    private final RateLimiter rateLimiter;

    /** Returns the preview for a URL, or 204 when none could be built. */
    @GetMapping
    public ResponseEntity<LinkPreview> preview(@RequestParam("url") String url,
                                               @AuthenticationPrincipal String username) {
        if (!rateLimiter.tryAcquire("preview:" + username, PREVIEW_BURST, PREVIEW_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many link previews, please wait a moment and try again");
        }
        LinkPreview preview = linkPreviewService.preview(url);
        return preview == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(preview);
    }
}
