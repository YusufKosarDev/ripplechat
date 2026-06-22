package com.ripplechat.backend.redis;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisStompSubscriber {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * This method is invoked by the RedisMessageListenerAdapter whenever a message
     * is published to the STOMP_TOPIC on Redis.
     * 
     * @param message the deserialized message containing destination and raw JSON payload
     */
    public void handleMessage(RedisStompMessage message) {
        if (message == null || message.getDestination() == null) {
            return;
        }
        
        try {
            // We pass the raw JSON string directly to STOMP. 
            // Our frontend uses JSON.parse(body) so raw JSON string works perfectly.
            messagingTemplate.convertAndSend(message.getDestination(), message.getPayloadJson());
        } catch (Exception e) {
            log.error("Error pushing Redis message to STOMP destination: {}", message.getDestination(), e);
        }
    }
}
