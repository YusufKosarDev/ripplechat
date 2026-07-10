package com.ripplechat.backend.redis;

import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisStompSubscriber {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.websocket.broker.type:simple}")
    private String brokerType;

    /**
     * This method is invoked by the RedisMessageListenerAdapter whenever a message
     * is published to the STOMP_TOPIC on Redis.
     * 
     * @param message the deserialized message containing destination and raw JSON payload
     */
    public void handleMessage(RedisStompMessage message) {
        if ("rabbitmq".equalsIgnoreCase(brokerType)) {
            return; // No-op, RabbitMQ manages message replication directly
        }

        if (message == null || message.getDestination() == null) {
            return;
        }
        
        try {
            // Parse the JSON string back into an Object so SimpMessagingTemplate
            // uses the MappingJackson2MessageConverter and sets application/json headers.
            Object payload = objectMapper.readValue(message.getPayloadJson(), Object.class);
            messagingTemplate.convertAndSend(message.getDestination(), payload);
        } catch (Exception e) {
            log.error("Error pushing Redis message to STOMP destination: {}", message.getDestination(), e);
        }
    }
}
