package com.ripplechat.backend.websocket;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

    /** Same allowlist as REST CORS (env APP_ALLOWED_ORIGINS); no "*" in prod. */
    private final String allowedOrigins;
    private final String brokerType;
    private final String rabbitmqHost;
    private final int rabbitmqStompPort;
    private final String rabbitmqUsername;
    private final String rabbitmqPassword;

    public WebSocketConfig(StompAuthChannelInterceptor stompAuthChannelInterceptor,
                           @Value("${app.allowed-origins:}") String allowedOrigins,
                           @Value("${app.websocket.broker.type:simple}") String brokerType,
                           @Value("${spring.rabbitmq.host:localhost}") String rabbitmqHost,
                           @Value("${app.rabbitmq.stomp.port:61613}") int rabbitmqStompPort,
                           @Value("${spring.rabbitmq.username:guest}") String rabbitmqUsername,
                           @Value("${spring.rabbitmq.password:guest}") String rabbitmqPassword) {
        this.stompAuthChannelInterceptor = stompAuthChannelInterceptor;
        this.allowedOrigins = allowedOrigins;
        this.brokerType = brokerType;
        this.rabbitmqHost = rabbitmqHost;
        this.rabbitmqStompPort = rabbitmqStompPort;
        this.rabbitmqUsername = rabbitmqUsername;
        this.rabbitmqPassword = rabbitmqPassword;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
        // Raw WebSocket endpoint.
        registry.addEndpoint("/ws").setAllowedOriginPatterns(origins);
        // Same path with SockJS fallback for browsers without native WebSocket.
        registry.addEndpoint("/ws").setAllowedOriginPatterns(origins).withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Clients subscribe under /topic; the app handles inbound sends under /app.
        registry.setApplicationDestinationPrefixes("/app");
        if ("rabbitmq".equalsIgnoreCase(brokerType)) {
            registry.enableStompBrokerRelay("/topic")
                    .setRelayHost(rabbitmqHost)
                    .setRelayPort(rabbitmqStompPort)
                    .setClientLogin(rabbitmqUsername)
                    .setClientPasscode(rabbitmqPassword)
                    .setSystemLogin(rabbitmqUsername)
                    .setSystemPasscode(rabbitmqPassword);
        } else {
            registry.enableSimpleBroker("/topic");
        }
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
    }
}
