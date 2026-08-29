package com.ripplechat.backend.push;

import com.ripplechat.backend.push.dto.PushPayload;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WebPushServiceTests extends AbstractIntegrationTest {

    @Autowired
    WebPushService webPushService;
    @Autowired
    PushSubscriptionRepository subscriptionRepository;

    @Test
    void pushIsDisabledWithoutVapidKeys() {
        // No VAPID keys in the test config — push is off but the app runs.
        assertThat(webPushService.isEnabled()).isFalse();
    }

    @Test
    void subscribeIsIdempotentByEndpointAndUnsubscribeRemoves() {
        User alice = createUser("alice");
        webPushService.subscribe(alice.getId(), "https://push.example/ep1", "p256", "auth");
        webPushService.subscribe(alice.getId(), "https://push.example/ep1", "p256", "auth");

        assertThat(subscriptionRepository.findByUserIdIn(Set.of(alice.getId()))).hasSize(1);

        webPushService.unsubscribe(alice.getId(), "https://push.example/ep1");
        assertThat(subscriptionRepository.findByUserIdIn(Set.of(alice.getId()))).isEmpty();
    }

    @Test
    void signingInOnASharedBrowserMovesTheEndpointToTheNewAccount() {
        User alice = createUser("alice_shared");
        User bob = createUser("bob_shared");
        String endpoint = "https://push.example/shared-browser";

        webPushService.subscribe(alice.getId(), endpoint, "p256", "auth");
        webPushService.subscribe(bob.getId(), endpoint, "p256-b", "auth-b");

        // An endpoint identifies a browser, not an account. Treating an existing
        // one as "already done" left it pointing at whoever signed in first, so
        // the next person's device buzzed with the previous person's messages.
        assertThat(subscriptionRepository.findByUserIdIn(Set.of(alice.getId()))).isEmpty();
        assertThat(subscriptionRepository.findByUserIdIn(Set.of(bob.getId()))).hasSize(1);
    }

    @Test
    void anEndpointThePushServiceCallsGoneIsDropped() {
        User alice = createUser("alice_gone");
        webPushService.subscribe(alice.getId(), "https://push.example/dead", "p256", "auth");
        webPushService.subscribe(alice.getId(), "https://push.example/live", "p256", "auth");
        assertThat(subscriptionRepository.findByUserIdIn(Set.of(alice.getId()))).hasSize(2);

        // 410 Gone means the browser has thrown this registration away for good.
        // Nothing pruned them before, so dead endpoints accumulated for every
        // browser that ever cleared its data and every send walked the whole list.
        // Push is inert without VAPID keys, so the delivery outcome is supplied
        // here rather than reached through a real push service.
        webPushService.send(
                Set.of(alice.getId()),
                new PushPayload("t", "b", "/chat", false, UUID.randomUUID(), alice.getId()),
                (sub, payload) -> sub.getEndpoint().endsWith("/dead") ? 410 : 201);

        assertThat(subscriptionRepository.findByUserIdIn(Set.of(alice.getId())))
                .extracting(PushSubscription::getEndpoint)
                .containsExactly("https://push.example/live");
    }

    @Test
    void aTransientDeliveryFailureLeavesTheSubscriptionAlone() {
        User bob = createUser("bob_transient");
        webPushService.subscribe(bob.getId(), "https://push.example/flaky", "p256", "auth");

        // A 500 from the push service, or an outright exception, says nothing
        // about whether the endpoint is still good.
        webPushService.send(
                Set.of(bob.getId()),
                new PushPayload("t", "b", "/chat", false, UUID.randomUUID(), bob.getId()),
                (sub, payload) -> 500);
        webPushService.send(
                Set.of(bob.getId()),
                new PushPayload("t", "b", "/chat", false, UUID.randomUUID(), bob.getId()),
                (sub, payload) -> {
                    throw new IllegalStateException("network went away");
                });

        assertThat(subscriptionRepository.findByUserIdIn(Set.of(bob.getId()))).hasSize(1);
    }

    @Test
    void unsubscribeOnlyRemovesYourOwnRegistration() {
        User alice = createUser("alice_own");
        User bob = createUser("bob_own");
        webPushService.subscribe(alice.getId(), "https://push.example/alice", "p256", "auth");

        webPushService.unsubscribe(bob.getId(), "https://push.example/alice");

        assertThat(subscriptionRepository.findByUserIdIn(Set.of(alice.getId()))).hasSize(1);
    }
}
