package com.ripplechat.backend.redis;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
     * Broadcasts the payload, deferring until after commit when a transaction is
     * in progress.
     *
     * <p>Callers broadcast from inside {@code @Transactional} service methods,
     * and the send used to go out immediately — before the row it describes was
     * committed. Anything failing later in the same method (the mention
     * notifications after a send, say) rolled the message back after every open
     * client had already drawn it, leaving a message on screen that no reload
     * would find. It also let a client fetch history in the window between the
     * broadcast and the commit and not see the message it had just been told
     * about.
     *
     * <p>Hooking the transaction here rather than at each call site fixes every
     * path at once — sends, edits, deletes, reactions, polls, read receipts,
     * channel deletion — and matches what the push listener already does with
     * {@code @TransactionalEventListener(AFTER_COMMIT)}. Payloads are immutable
     * DTOs, so holding one until commit cannot change what is sent. With no
     * transaction active (typing indicators, presence) it sends immediately.
     */
    public void broadcast(String destination, Object payload) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish(destination, payload);
                }
            });
            return;
        }
        publish(destination, payload);
    }

    private void publish(String destination, Object payload) {
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
