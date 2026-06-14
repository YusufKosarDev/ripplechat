package com.ripplechat.backend.push;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Web Push configuration. VAPID keys come from the environment; when they're
 * absent push is disabled (the app still runs). Generate a key pair with
 * {@code npx web-push generate-vapid-keys} and set VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY (and optionally VAPID_SUBJECT).
 */
@Configuration
@EnableAsync
public class PushConfig {

    @Bean
    public WebPushKeys webPushKeys(
            @Value("${VAPID_PUBLIC_KEY:}") String publicKey,
            @Value("${VAPID_PRIVATE_KEY:}") String privateKey,
            @Value("${VAPID_SUBJECT:mailto:admin@ripplechat.app}") String subject) {
        return new WebPushKeys(publicKey, privateKey, subject);
    }

    public record WebPushKeys(String publicKey, String privateKey, String subject) {
        public boolean enabled() {
            return publicKey != null && !publicKey.isBlank() && privateKey != null && !privateKey.isBlank();
        }
    }
}
