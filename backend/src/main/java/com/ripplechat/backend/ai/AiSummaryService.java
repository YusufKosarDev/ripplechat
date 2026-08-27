package com.ripplechat.backend.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.ripplechat.backend.common.dto.PageResponse;
import com.ripplechat.backend.message.MessageQueryService;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.redis.RateLimiter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * AI-powered channel summarization via the official Anthropic (Claude) SDK.
 * "Catch me up": summarize a channel's recent messages into a short digest.
 *
 * <p>Gracefully disabled when {@code ANTHROPIC_API_KEY} is unset — the client is
 * never built and the endpoint returns 503, mirroring the other credentialed
 * integrations (Cloudinary, VAPID, Giphy), so the app always boots.
 *
 * <p>Note: this is text summarization, which Claude does natively. Embeddings-
 * based semantic search would need a separate embeddings provider (Anthropic
 * has no embeddings endpoint) and is out of scope here.
 */
@Service
@Slf4j
public class AiSummaryService {

    private static final int MAX_MESSAGES = 60;
    // AI calls cost money — throttle per user: ~3 burst, then ~1 every 20s.
    private static final double AI_BURST = 3;
    private static final double AI_REFILL_PER_SEC = 0.05;

    private final MessageQueryService messageQueryService;
    private final RateLimiter rateLimiter;
    private final AnthropicClient client; // null when disabled
    private final String model;

    public AiSummaryService(MessageQueryService messageQueryService,
                            RateLimiter rateLimiter,
                            @Value("${ANTHROPIC_API_KEY:}") String apiKey,
                            @Value("${AI_MODEL:claude-sonnet-5}") String model) {
        this.messageQueryService = messageQueryService;
        this.rateLimiter = rateLimiter;
        this.model = model;
        this.client = (apiKey == null || apiKey.isBlank())
                ? null
                : AnthropicOkHttpClient.builder().apiKey(apiKey).build();
        if (this.client == null) {
            log.info("AI summarization disabled (ANTHROPIC_API_KEY not set).");
        }
    }

    public boolean isEnabled() {
        return client != null;
    }

    /** Summarizes the channel's recent messages for the requesting member. */
    public String summarizeChannel(UUID channelId, String username) {
        if (client == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI summarization is not configured");
        }
        if (!rateLimiter.tryAcquire("ai:" + username, AI_BURST, AI_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "too many AI requests, please wait a moment and try again");
        }

        // "Catch me up" means the *recent* window: fetch the newest MAX_MESSAGES
        // (page 0, newest-first — the feed query has no ORDER BY, so the Pageable's
        // sort decides), then flip back to chronological order so the transcript
        // reads oldest→newest for the model. Membership is enforced here (403 for
        // non-members). Deleted/empty messages are dropped from the transcript.
        PageResponse<MessageResponse> page = messageQueryService.findByChannel(
                channelId, username, PageRequest.of(0, MAX_MESSAGES, Sort.by("createdAt").descending()));
        List<MessageResponse> chronological = new ArrayList<>(page.content());
        Collections.reverse(chronological);
        String transcript = chronological.stream()
                .filter(m -> !m.deleted() && m.content() != null && !m.content().isBlank())
                .map(m -> senderName(m) + ": " + m.content())
                .collect(Collectors.joining("\n"));
        if (transcript.isBlank()) {
            return "No messages to summarize in this channel yet.";
        }

        try {
            MessageCreateParams params =
                    MessageCreateParams.builder()
                            .model(model)
                            .maxTokens(1024L)
                            .system("You summarize a group chat for a member who is catching up. "
                                    + "Reply in the same language as the conversation. "
                                    + "Give a short digest: the main topics, any decisions, and open "
                                    + "questions, as a few concise bullet points. Do not invent details "
                                    + "that aren't in the messages.")
                            .addUserMessage("Summarize this chat:\n\n" + transcript)
                            .build();

            Message response = client.messages().create(params);
            StringBuilder sb = new StringBuilder();
            response.content().forEach(block -> block.text().ifPresent(t -> sb.append(t.text())));
            String summary = sb.toString().strip();
            return summary.isBlank() ? "Could not generate a summary." : summary;
        } catch (RuntimeException e) {
            log.error("AI summary failed for channel {}", channelId, e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI summary failed, please try again");
        }
    }

    private static String senderName(MessageResponse m) {
        var s = m.sender();
        return s.displayName() != null ? s.displayName() : s.username();
    }
}
