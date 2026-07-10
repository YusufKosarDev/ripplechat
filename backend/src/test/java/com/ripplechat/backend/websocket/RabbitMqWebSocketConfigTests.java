package com.ripplechat.backend.websocket;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "app.websocket.broker.type=rabbitmq",
                "spring.rabbitmq.host=localhost",
                "app.rabbitmq.stomp.port=61613"
        }
)
class RabbitMqWebSocketConfigTests {

    @DynamicPropertySource
    static void containerProperties(DynamicPropertyRegistry registry) {
        com.ripplechat.backend.support.SharedContainers.apply(registry);
    }

    @Value("${app.websocket.broker.type}")
    private String brokerType;

    @Test
    void contextLoadsWithRabbitMqBrokerType() {
        assertThat(brokerType).isEqualTo("rabbitmq");
    }
}
