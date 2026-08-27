package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.search.dto.SearchResultResponse;
import com.ripplechat.backend.user.BlockService;
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

import java.time.Instant;
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
    @Autowired
    BlockService blockService;
    @Autowired
    ChannelMembershipService membershipService;

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

    /**
     * Blocked authors never reach the caller either way — SearchService drops
     * them while hydrating ({@code findForSearchByIdsFiltered}), whichever
     * backend ranked the ids. Asserted here so that guarantee stays covered on
     * the fallback path too.
     */
    @Test
    void blockedAuthorsAreExcludedFromResults() {
        createUser("alice");
        User bob = createUser("bob");
        var channel = channelService.create(new CreateChannelRequest("blocking", null, false), "alice");
        membershipService.join(channel.id(), "bob");
        messageService.send(channel.id(), new CreateMessageRequest("kubernetes rollout notes", null), "bob");
        messageService.send(channel.id(), new CreateMessageRequest("kubernetes upgrade plan", null), "alice");

        assertThat(searchService.searchMessages("alice", "kubernetes")).hasSize(2);

        blockService.block("alice", bob.getId());

        assertThat(searchService.searchMessages("alice", "kubernetes"))
                .as("a blocked author's messages must not appear in search")
                .extracting(SearchResultResponse::content)
                .containsExactly("kubernetes upgrade plan");
    }

    /**
     * Why the index itself must also exclude blocked authors, even though
     * hydration already drops them: it ranks and pages the ids first. A blocked
     * author's message that occupies the only slot on a page used to leave that
     * page empty, hiding a message the viewer was entitled to see.
     */
    @Test
    void blockedAuthorsDoNotConsumeSlotsInAPage() {
        createUser("frank");
        User grace = createUser("grace");
        var channel = channelService.create(new CreateChannelRequest("paging", null, false), "frank");
        membershipService.join(channel.id(), "grace");
        // grace posts first, so she ranks ahead of frank on the tie-broken order.
        messageService.send(channel.id(), new CreateMessageRequest("prometheus alert rules", null), "grace");
        messageService.send(channel.id(), new CreateMessageRequest("prometheus alert rules", null), "frank");

        blockService.block("frank", grace.getId());

        assertThat(searchService.searchPage("frank", "prometheus", null, null, null, 0, 1).results())
                .as("the one visible message must still fill the single-result page")
                .extracting(SearchResultResponse::content)
                .containsExactly("prometheus alert rules");
    }

    /** The sender filter was accepted and ignored by the fallback too. */
    @Test
    void senderFilterRestrictsToOneAuthor() {
        createUser("carol");
        createUser("dave");
        var channel = channelService.create(new CreateChannelRequest("filters", null, false), "carol");
        membershipService.join(channel.id(), "dave");
        messageService.send(channel.id(), new CreateMessageRequest("terraform state locking", null), "carol");
        messageService.send(channel.id(), new CreateMessageRequest("terraform module layout", null), "dave");

        assertThat(searchService.searchPage("carol", "terraform", null, "dave", null, 0, 20).results())
                .extracting(SearchResultResponse::content)
                .containsExactly("terraform module layout");
    }

    /** And so was the date filter. */
    @Test
    void sinceFilterExcludesOlderMessages() {
        createUser("erin");
        var channel = channelService.create(new CreateChannelRequest("dates", null, false), "erin");
        messageService.send(channel.id(), new CreateMessageRequest("ansible playbook draft", null), "erin");

        assertThat(searchService.searchPage("erin", "ansible", null, null, Instant.now().minusSeconds(600), 0, 20).results())
                .as("a cutoff before the message keeps it")
                .hasSize(1);
        assertThat(searchService.searchPage("erin", "ansible", null, null, Instant.now().plusSeconds(600), 0, 20).results())
                .as("a cutoff after the message drops it")
                .isEmpty();
    }

    private User createUser(String username) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@test.io");
        user.setDisplayName(username);
        user.setPassword(passwordEncoder.encode("password123"));
        return userRepository.saveAndFlush(user);
    }
}
