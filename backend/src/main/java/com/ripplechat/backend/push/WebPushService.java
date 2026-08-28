package com.ripplechat.backend.push;

import tools.jackson.databind.ObjectMapper;
import com.ripplechat.backend.common.MessagePreview;
import com.ripplechat.backend.channel.Channel;
import com.ripplechat.backend.channel.ChannelType;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.message.Message;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.presence.PresenceService;
import com.ripplechat.backend.push.PushConfig.WebPushKeys;
import com.ripplechat.backend.push.dto.PushPayload;
import com.ripplechat.backend.user.UserBlockRepository;
import jakarta.annotation.PostConstruct;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Web Push (VAPID). Stores browser subscriptions and notifies offline channel
 * members of new messages. Disabled (a no-op) when VAPID keys are not set.
 */
@Service
public class WebPushService {

    private static final Logger log = LoggerFactory.getLogger(WebPushService.class);
    private static final int SNIPPET = 120;

    private final WebPushKeys keys;
    private final PushSubscriptionRepository subscriptionRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final MessageRepository messageRepository;
    private final PresenceService presenceService;
    private final ObjectMapper objectMapper;
    private final UserBlockRepository blockRepository;
    private PushService pushService;

    public WebPushService(WebPushKeys keys,
                          PushSubscriptionRepository subscriptionRepository,
                          ChannelMembershipRepository membershipRepository,
                          MessageRepository messageRepository,
                          PresenceService presenceService,
                          ObjectMapper objectMapper,
                          UserBlockRepository blockRepository) {
        this.keys = keys;
        this.subscriptionRepository = subscriptionRepository;
        this.membershipRepository = membershipRepository;
        this.messageRepository = messageRepository;
        this.presenceService = presenceService;
        this.objectMapper = objectMapper;
        this.blockRepository = blockRepository;
    }

    @PostConstruct
    void init() {
        if (!keys.enabled()) {
            log.info("VAPID keys not set — web push disabled");
            return;
        }
        Security.addProvider(new BouncyCastleProvider());
        try {
            this.pushService = new PushService(keys.publicKey(), keys.privateKey(), keys.subject());
            log.info("Web push enabled");
        } catch (Exception e) {
            log.error("Failed to initialize web push", e);
        }
    }

    public boolean isEnabled() {
        return pushService != null;
    }

    public String publicKey() {
        return keys.publicKey() == null ? "" : keys.publicKey();
    }

    /**
     * Registers this browser for push, or moves an existing registration to the
     * signed-in user.
     *
     * <p>An endpoint identifies a browser, not an account, and it is stable
     * across sign-ins. Treating an existing one as "already done" meant that
     * after someone signed out and a second person signed in on the same
     * browser, the endpoint stayed attached to the first account — and the
     * second person's device buzzed with the first person's messages.
     */
    @Transactional
    public void subscribe(UUID userId, String endpoint, String p256dh, String auth) {
        PushSubscription sub = subscriptionRepository.findByEndpoint(endpoint)
                .orElseGet(PushSubscription::new);
        sub.setUserId(userId);
        sub.setEndpoint(endpoint);
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        subscriptionRepository.save(sub);
    }

    /** Removes this browser's registration — only the account that owns it may. */
    @Transactional
    public void unsubscribe(UUID userId, String endpoint) {
        subscriptionRepository.findByEndpoint(endpoint)
                .filter(sub -> sub.getUserId().equals(userId))
                .ifPresent(subscriptionRepository::delete);
    }

    /**
     * Notifies offline members of a channel about a new message (best-effort, async).
     *
     * <p>Read-write, not read-only: {@link #send} prunes subscriptions the push
     * service reports as gone, and that delete would fail to flush on a
     * read-only connection.
     */
    @Async
    @Transactional
    public void notifyChannelMessage(UUID channelId, UUID messageId, String senderUsername) {
        if (pushService == null) {
            return;
        }
        Message message = messageRepository.findById(messageId).orElse(null);
        if (message == null) {
            return;
        }
        UUID senderId = message.getSender().getId();
        Set<String> online = presenceService.onlineUsernames();
        Set<UUID> recipients = new HashSet<>();
        for (var membership : membershipRepository.findByChannelId(channelId)) {
            String username = membership.getUser().getUsername();
            // Skip the sender, anyone currently online, and anyone in Do-Not-Disturb.
            if (!username.equals(senderUsername) && !online.contains(username)
                    && !membership.getUser().isDndActive()) {
                UUID recipientId = membership.getUser().getId();
                if (!blockRepository.existsByBlockerIdAndBlockedId(recipientId, senderId)) {
                    recipients.add(recipientId);
                }
            }
        }
        if (recipients.isEmpty()) {
            return;
        }

        Channel channel = message.getChannel();
        String senderName = message.getSender().getDisplayName() != null
                ? message.getSender().getDisplayName() : message.getSender().getUsername();
        boolean direct = channel.getType() == ChannelType.DIRECT;
        String title = direct ? senderName : "#" + channel.getName();
        
        String rawBody = snippet(message);
        boolean isEncrypted = rawBody.startsWith("enc:v1:") || rawBody.startsWith("enc:v2:") || rawBody.startsWith("enc:group:");
        String body = direct ? rawBody : senderName + ": " + rawBody;
        
        send(recipients, new PushPayload(title, body, "/chat", isEncrypted, channel.getId(), senderId));
    }

    /**
     * Delivers one notification and reports the push service's status code.
     *
     * <p>A seam, not an abstraction: it exists so the delivery *outcome* can be
     * exercised. Push is inert without VAPID keys — {@link #pushService} stays
     * null and {@link #notifyChannelMessage} returns immediately — so the
     * subscription pruning below could not otherwise be reached by any test.
     */
    @FunctionalInterface
    interface PushTransport {
        int deliver(PushSubscription sub, byte[] payload) throws Exception;
    }

    /** Production delivery: the real web-push client over VAPID. */
    private PushTransport realTransport() {
        return (sub, payload) -> pushService
                .send(new Notification(sub.getEndpoint(), sub.getP256dh(), sub.getAuth(), payload))
                .getStatusLine()
                .getStatusCode();
    }

    private void send(Set<UUID> userIds, PushPayload payload) {
        send(userIds, payload, realTransport());
    }

    /** Package-private so a test can supply the delivery outcome directly. */
    @Transactional
    void send(Set<UUID> userIds, PushPayload payload, PushTransport transport) {
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            return;
        }
        for (PushSubscription sub : subscriptionRepository.findByUserIdIn(userIds)) {
            try {
                int status = transport.deliver(sub, json.getBytes(StandardCharsets.UTF_8));
                if (status == 404 || status == 410) {
                    // The push service says this endpoint is gone for good. Nothing
                    // pruned them before, so dead registrations accumulated for
                    // every browser that ever uninstalled the app or cleared data,
                    // and every send walked the whole list.
                    log.debug("Dropping expired push subscription (status {})", status);
                    subscriptionRepository.delete(sub);
                }
            } catch (Exception e) {
                log.warn("Web push send failed for an endpoint: {}", e.getMessage());
            }
        }
    }

    private String snippet(Message message) {
        String content = message.getContent() == null ? "" : message.getContent();
        if (content.isBlank() && message.getAttachmentUrl() != null) {
            return MessagePreview.ATTACHMENT;
        }
        return content.length() > SNIPPET ? content.substring(0, SNIPPET) : content;
    }
}
