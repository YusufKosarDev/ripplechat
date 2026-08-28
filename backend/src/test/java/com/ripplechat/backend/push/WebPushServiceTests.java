package com.ripplechat.backend.push;

import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Set;

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
    void unsubscribeOnlyRemovesYourOwnRegistration() {
        User alice = createUser("alice_own");
        User bob = createUser("bob_own");
        webPushService.subscribe(alice.getId(), "https://push.example/alice", "p256", "auth");

        webPushService.unsubscribe(bob.getId(), "https://push.example/alice");

        assertThat(subscriptionRepository.findByUserIdIn(Set.of(alice.getId()))).hasSize(1);
    }
}
