package com.ripplechat.backend.websocket;

import com.ripplechat.backend.auth.JwtService;
import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.PostgreSQLContainer;

import java.lang.reflect.Type;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end realtime test: opens a real STOMP-over-WebSocket connection
 * (JWT-authenticated on CONNECT), subscribes to a channel topic, and asserts a
 * sent message is broadcast to the subscriber — the core live-messaging path.
 * Runs with a real server (random port) and a real PostgreSQL (Testcontainers).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RealtimeMessagingTests {

    @SuppressWarnings("resource")
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @LocalServerPort
    int port;
    @Autowired
    UserRepository userRepository;
    @Autowired
    org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Autowired
    JwtService jwtService;
    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;

    @Test
    void subscriberReceivesABroadcastMessage() throws Exception {
        User user = new User();
        user.setUsername("ws-user");
        user.setEmail("ws-user@test.io");
        user.setDisplayName("WS User");
        user.setPassword(passwordEncoder.encode("password123"));
        userRepository.saveAndFlush(user);
        String token = jwtService.generateToken("ws-user");
        ChannelResponse channel = channelService.create(new CreateChannelRequest("rt", null, false), "ws-user");

        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        // The server broadcasts JSON, so the client needs a JSON converter; map to
        // a generic Map to avoid coupling to the DTO (and any date-format config).
        client.setMessageConverter(new MappingJackson2MessageConverter());

        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);

        StompSession session = client.connectAsync(
                "ws://localhost:" + port + "/ws",
                new WebSocketHttpHeaders(),
                connectHeaders,
                new StompSessionHandlerAdapter() {
                }).get(10, TimeUnit.SECONDS);

        BlockingQueue<Object> received = new LinkedBlockingQueue<>();
        session.subscribe("/topic/channels/" + channel.id(), new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                received.add(payload);
            }
        });
        // Let the SUBSCRIBE frame be processed before broadcasting.
        Thread.sleep(750);

        messageService.send(channel.id(), new CreateMessageRequest("hello-realtime", null), "ws-user");

        Object frame = received.poll(10, TimeUnit.SECONDS);
        assertThat(frame).as("broadcast frame should arrive").isInstanceOf(Map.class);
        assertThat(((Map<?, ?>) frame).get("content")).isEqualTo("hello-realtime");

        session.disconnect();
        client.stop();
    }
}
