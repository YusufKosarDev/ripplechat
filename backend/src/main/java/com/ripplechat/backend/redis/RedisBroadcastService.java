package com.ripplechat.backend.redis;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class RedisBroadcastService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;

    private final String brokerType;

    public RedisBroadcastService(RedisTemplate<String, Object> redisTemplate,
                                 ObjectMapper objectMapper,
                                 SimpMessagingTemplate messagingTemplate,
                                 @Value("${app.websocket.broker.type:simple}") String brokerType) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.messagingTemplate = messagingTemplate;
        this.brokerType = brokerType;
    }

    /**
     * Broadcasts the payload. If the broker type is rabbitmq, it delegates directly
     * to SimpMessagingTemplate as RabbitMQ natively replicates messages to all nodes.
     * Otherwise, it serializes and publishes to Redis Pub/Sub STOMP_TOPIC for SimpleBroker.
     */
    public void broadcast(String destination, Object payload) {
        if ("rabbitmq".equalsIgnoreCase(brokerType)) {
            messagingTemplate.convertAndSend(destination, payload);
            return;
        }

        try {
            String payloadJson;
            if (payload instanceof String) {
                payloadJson = (String) payload; // In case it's already a JSON string
            } else {
                payloadJson = objectMapper.writeValueAsString(payload);
            }
            
            RedisStompMessage message = new RedisStompMessage(destination, payloadJson);
            redisTemplate.convertAndSend(RedisConfig.STOMP_TOPIC, message);
        } catch (JacksonException e) {
            log.error("Failed to serialize STOMP payload for Redis broadcast. Destination: {}", destination, e);
        }
    }
}
