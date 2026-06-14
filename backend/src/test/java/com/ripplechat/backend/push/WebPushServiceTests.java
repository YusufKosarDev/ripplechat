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

        webPushService.unsubscribe("https://push.example/ep1");
        assertThat(subscriptionRepository.findByUserIdIn(Set.of(alice.getId()))).isEmpty();
    }
}
