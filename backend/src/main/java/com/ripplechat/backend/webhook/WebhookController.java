package com.ripplechat.backend.webhook;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class WebhookController {

    private final WebhookService webhookService;

    /** Create an incoming webhook for a channel (owner/moderator only). */
    @PostMapping("/api/channels/{channelId}/webhooks")
    @ResponseStatus(HttpStatus.CREATED)
    public WebhookResponse create(@PathVariable UUID channelId,
                                  @Valid @RequestBody CreateWebhookRequest request,
                                  @AuthenticationPrincipal String username) {
        return webhookService.create(channelId, username, request);
    }

    /** List a channel's webhooks (owner/moderator only); tokens are never returned. */
    @GetMapping("/api/channels/{channelId}/webhooks")
    public List<WebhookResponse> list(@PathVariable UUID channelId,
                                      @AuthenticationPrincipal String username) {
        return webhookService.list(channelId, username);
    }

    @DeleteMapping("/api/channels/{channelId}/webhooks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID channelId,
                       @PathVariable UUID id,
                       @AuthenticationPrincipal String username) {
        webhookService.delete(channelId, id, username);
    }

    /**
     * Public ingest endpoint — authenticated only by the high-entropy token in the
     * path (permit-listed in SecurityConfig). Posts the payload to the channel.
     */
    @PostMapping("/api/hooks/{token}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void ingest(@PathVariable String token, @Valid @RequestBody WebhookIngestRequest request) {
        webhookService.ingest(token, request);
    }
}
