package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.search.dto.SearchResultResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.springframework.test.context.TestPropertySource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the Elasticsearch search path explicitly. The application default is
 * the PostgreSQL fallback, so without this the suite would silently drift onto
 * that backend and leave the Elasticsearch implementation untested -- with no
 * test failing to say so.
 */
@TestPropertySource(properties = "app.search.elasticsearch.enabled=true")
class MessageSearchTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;
    @Autowired
    SearchService searchService;

    @Test
    void findsMessagesByWordAndScopesToMembership() throws InterruptedException {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("RippleChat'e hoş geldin", null), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("bugün hava çok güzel", null), "owner");

        Thread.sleep(1500); // Wait for ES to index and refresh

        List<SearchResultResponse> results = searchService.searchMessages("owner", "hoş");
        assertThat(results).hasSize(1);
        assertThat(results.get(0).content()).contains("hoş geldin");

        // A non-member has no channels, so search returns nothing.
        assertThat(searchService.searchMessages("outsider", "hoş")).isEmpty();
    }

    @Test
    void matchesByPrefix() throws InterruptedException {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("deployment pipeline hazır", null), "owner");

        Thread.sleep(1500); // Wait for ES to index and refresh

        // Prefix query "deploy" should now match the ngram token "deployment"
        assertThat(searchService.searchMessages("owner", "deploy")).hasSize(1);
    }

    @Test
    void blankOrSymbolOnlyQueryReturnsEmpty() {
        createUser("owner");
        channelService.create(new CreateChannelRequest("genel", null, false), "owner");
        assertThat(searchService.searchMessages("owner", "   ")).isEmpty();
        assertThat(searchService.searchMessages("owner", "!!! ???")).isEmpty();
    }
}
