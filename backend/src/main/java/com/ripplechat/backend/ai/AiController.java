package com.ripplechat.backend.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiSummaryService aiSummaryService;

    /** Whether AI features are configured (so the client can show/hide the button). */
    @GetMapping("/status")
    public Map<String, Boolean> status() {
        return Map.of("enabled", aiSummaryService.isEnabled());
    }

    /** Summarize a channel's recent messages for the caller. */
    @PostMapping("/channels/{channelId}/summary")
    public Map<String, String> summarizeChannel(@PathVariable UUID channelId,
                                                @AuthenticationPrincipal String username) {
        return Map.of("summary", aiSummaryService.summarizeChannel(channelId, username));
    }
}
