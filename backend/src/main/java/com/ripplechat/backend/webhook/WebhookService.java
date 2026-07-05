package com.ripplechat.backend.webhook;

import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.membership.ChannelMembership;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.channel.membership.MembershipRole;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.redis.RateLimiter;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Incoming webhooks. A channel owner/moderator creates one, gets a one-time URL
 * containing a high-entropy token, and external systems POST to it. Each webhook
 * has its own bot {@link User} so posted messages flow through the normal
 * {@link MessageService#send} pipeline and render like any other message.
 */
@Service
@RequiredArgsConstructor
public class WebhookService {

    // Per-webhook ingest throttle: ~30 burst, then ~1/sec.
    private static final double INGEST_BURST = 30;
    private static final double INGEST_REFILL_PER_SEC = 1;

    private final WebhookRepository webhookRepository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipService membershipService;
    private final ChannelMembershipRepository membershipRepository;
    private final MessageService messageService;
    private final RateLimiter rateLimiter;

    private final SecureRandom random = new SecureRandom();

    @Transactional
    public WebhookResponse create(UUID channelId, String username, CreateWebhookRequest request) {
        requireModerator(channelId, username);
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + channelId));
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isBlank()) {
            throw new BadRequestException("name is required");
        }
        User creator = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        // The bot must be a channel member, since MessageService.send posts on its behalf.
        User bot = createBotUser(name);
        addAsMember(channel, bot);

        String token = generateToken();
        Webhook webhook = new Webhook();
        webhook.setChannel(channel);
        webhook.setBotUser(bot);
        webhook.setTokenHash(hash(token));
        webhook.setName(name);
        webhook.setCreatedBy(creator);
        webhookRepository.save(webhook);

        return WebhookResponse.created(webhook, "/api/hooks/" + token);
    }

    @Transactional(readOnly = true)
    public List<WebhookResponse> list(UUID channelId, String username) {
        requireModerator(channelId, username);
        return webhookRepository.findByChannelIdOrderByCreatedAtAsc(channelId).stream()
                .map(WebhookResponse::from)
                .toList();
    }

    @Transactional
    public void delete(UUID channelId, UUID id, String username) {
        requireModerator(channelId, username);
        Webhook webhook = webhookRepository.findById(id)
                .filter(w -> w.getChannel().getId().equals(channelId))
                .orElseThrow(() -> new ResourceNotFoundException("webhook not found: " + id));

        User bot = webhook.getBotUser();
        // Mark the bot user as deleted so it is not left active or orphaned.
        // Its past messages will still render correctly using standard deleted-user logic.
        bot.setDeleted(true);
        userRepository.save(bot);

        membershipRepository.findByChannelIdAndUser_Id(channelId, bot.getId())
                .ifPresent(membershipRepository::delete);
        webhookRepository.delete(webhook);
    }

    /** Posts the payload to the webhook's channel, authenticated solely by the token. */
    @Transactional
    public void ingest(String token, WebhookIngestRequest request) {
        Webhook webhook = webhookRepository.findByTokenHash(hash(token))
                .orElseThrow(() -> new ResourceNotFoundException("webhook not found"));
        if (!rateLimiter.tryAcquire("webhook:" + webhook.getId(), INGEST_BURST, INGEST_REFILL_PER_SEC)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                     "too many webhook posts, please slow down");
        }
        String text = request.text() == null ? "" : request.text().trim();
        if (text.isBlank()) {
            throw new BadRequestException("text is required");
        }
        messageService.send(webhook.getChannel().getId(),
                new CreateMessageRequest(text, null),
                webhook.getBotUser().getUsername());
    }

    private void requireModerator(UUID channelId, String username) {
        if (!membershipService.canModerate(channelId, username)) {
            throw new ForbiddenException("only channel owners/moderators can manage webhooks");
        }
    }

    private void addAsMember(Channel channel, User bot) {
        ChannelMembership membership = new ChannelMembership();
        membership.setChannel(channel);
        membership.setUser(bot);
        membership.setRole(MembershipRole.MEMBER);
        membershipRepository.save(membership);
    }

    private User createBotUser(String displayName) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        User bot = new User();
        bot.setUsername("hook_" + suffix);
        bot.setEmail("hook_" + suffix + "@webhook.ripplechat.local");
        bot.setDisplayName(displayName);
        bot.setBot(true);
        return userRepository.save(bot);
    }

    private String generateToken() {
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
