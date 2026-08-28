package com.ripplechat.backend.gif;

import com.ripplechat.backend.redis.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/gifs")
@RequiredArgsConstructor
public class GifController {

    // Every search is an outbound call against a metered third-party quota:
    // ~20 burst, then one a second per user.
    private static final double GIF_BURST = 20;
    private static final double GIF_REFILL_PER_SEC = 1;

    private final GifService gifService;
    private final RateLimiter rateLimiter;

    /** Searches GIFs; {@code enabled} is false when no Giphy key is configured. */
    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(value = "q", required = false, defaultValue = "") String q,
                                      @AuthenticationPrincipal String username) {
        if (!rateLimiter.tryAcquire("gif:" + username, GIF_BURST, GIF_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many GIF searches, please wait a moment and try again");
        }
        return Map.of("enabled", gifService.isEnabled(), "results", gifService.search(q));
    }
}
