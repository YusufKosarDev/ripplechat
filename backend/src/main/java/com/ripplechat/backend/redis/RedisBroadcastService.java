package com.ripplechat.backend.redis;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisBroadcastService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Serializes the payload to JSON and publishes it to the Redis topic.
     * All backend instances (including this one) will receive it and broadcast it
     * via their local SimpMessagingTemplate.
     */
    public void broadcast(String destination, Object payload) {
        try {
            String payloadJson;
            if (payload instanceof String) {
                payloadJson = (String) payload; // In case it's already a JSON string
            } else {
                payloadJson = objectMapper.writeValueAsString(payload);
            }
            
            RedisStompMessage message = new RedisStompMessage(destination, payloadJson);
            redisTemplate.convertAndSend(RedisConfig.STOMP_TOPIC, message);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize STOMP payload for Redis broadcast. Destination: {}", destination, e);
        }
    }
}
