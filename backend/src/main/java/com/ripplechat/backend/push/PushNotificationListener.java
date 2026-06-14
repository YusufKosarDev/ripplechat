package com.ripplechat.backend.push;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Sends push notifications after a message's transaction commits. */
@Component
public class PushNotificationListener {

    private final WebPushService webPushService;

    public PushNotificationListener(WebPushService webPushService) {
        this.webPushService = webPushService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageSent(MessageSentEvent event) {
        webPushService.notifyChannelMessage(event.channelId(), event.messageId(), event.senderUsername());
    }
}
