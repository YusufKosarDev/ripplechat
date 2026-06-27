package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.search.dto.SearchResultResponse;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Boots the application with Elasticsearch turned off and unreachable, the way a
 * deployment without ES runs. Proves two things the ES-backed integration tests
 * cannot: (1) the context starts at all without contacting Elasticsearch — no
 * boot hang, no missing bean — and (2) search degrades gracefully to the
 * PostgreSQL full-text fallback while message sending keeps working.
 */
@SpringBootTest(properties = {
        "app.search.elasticsearch.enabled=false",
        "spring.data.elasticsearch.repositories.enabled=false",
        "management.health.elasticsearch.enabled=false",
        // Deliberately unreachable: the disabled search path must never touch it.
        "spring.elasticsearch.uris=http://localhost:59200"
})
@Testcontainers
class SearchWithoutElasticsearchTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    @Container
    @ServiceConnection(name = "redis")
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    @Autowired
    MessageSearchIndex searchIndex;
    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;
    @Autowired
    SearchService searchService;
    @Autowired
    UserRepository userRepository;
    @Autowired
    PasswordEncoder passwordEncoder;

    @Test
    void usesPostgresFallbackWhenElasticsearchDisabled() {
        // The disabled flag must select the PostgreSQL fallback implementation.
        assertThat(searchIndex).isInstanceOf(DatabaseMessageSearchIndex.class);

        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");

        // send() also calls the search index (a no-op here) — must not throw.
        messageService.send(channel.id(), new CreateMessageRequest("deployment pipeline hazır", null), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("bugün hava çok güzel", null), "owner");

        // PostgreSQL full-text search is synchronous, so results are visible at once.
        List<SearchResultResponse> hits = searchService.searchMessages("owner", "deploy");
        assertThat(hits).hasSize(1);
        assertThat(hits.get(0).content()).contains("deployment");

        // Membership scoping still holds: a non-member sees nothing.
        assertThat(searchService.searchMessages("outsider", "deploy")).isEmpty();
    }

    private void createUser(String username) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@test.io");
        user.setDisplayName(username);
        user.setPassword(passwordEncoder.encode("password123"));
        userRepository.saveAndFlush(user);
    }
}
