package com.ripplechat.backend.message;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.search.SearchService;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pinned to Elasticsearch: the de-indexing assertion below only means anything
 * against a backend that holds its own copy of the message. On the PostgreSQL
 * backend the rows are the index, so clearing the content passes the assertion
 * without proving the sweep de-indexed anything. Tests inherit the default,
 * which is PostgreSQL, so this has to be explicit.
 */
@TestPropertySource(properties = "app.search.elasticsearch.enabled=true")
class DisappearingMessageTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    MessageService messageService;
    @Autowired
    MessageModerationService moderationService;
    @Autowired
    MessageRepository messageRepository;
    @Autowired
    SearchService searchService;

    @Test
    void timerStampsExpiryAndCanBeTurnedOff() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        ChannelResponse on = channelService.setDisappearing(channel.id(), "owner", 3600);
        assertThat(on.messageTtlSeconds()).isEqualTo(3600);

        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("hi", null), "owner");
        assertThat(msg.expiresAt()).isNotNull();

        ChannelResponse off = channelService.setDisappearing(channel.id(), "owner", 0);
        assertThat(off.messageTtlSeconds()).isNull();

        MessageResponse plain = messageService.send(channel.id(), new CreateMessageRequest("bye", null), "owner");
        assertThat(plain.expiresAt()).isNull();
    }

    @Test
    void purgeExpiredSoftDeletesPastMessages() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        channelService.setDisappearing(channel.id(), "owner", 3600);

        MessageResponse msg = messageService.send(channel.id(), new CreateMessageRequest("secret", null), "owner");

        Message stored = messageRepository.findById(msg.id()).orElseThrow();
        stored.setExpiresAt(Instant.now().minusSeconds(10));
        messageRepository.saveAndFlush(stored);

        moderationService.purgeExpired();

        Message after = messageRepository.findById(msg.id()).orElseThrow();
        assertThat(after.isDeleted()).isTrue();
        assertThat(after.getContent()).isEmpty();
    }

    /**
     * The expiry sweep used to inline its own soft-delete and omitted the search
     * de-indexing that the explicit delete performed, so a disappearing message
     * stayed findable by its content after the content itself was gone. Both
     * paths now share one softDelete().
     */
    @Test
    void purgeExpiredAlsoRemovesTheMessageFromSearch() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        channelService.setDisappearing(channel.id(), "owner", 3600);

        MessageResponse msg = messageService.send(
                channel.id(), new CreateMessageRequest("pineapple embargo", null), "owner");
        assertThat(searchService.searchMessages("owner", "pineapple")).hasSize(1);

        Message stored = messageRepository.findById(msg.id()).orElseThrow();
        stored.setExpiresAt(Instant.now().minusSeconds(10));
        messageRepository.saveAndFlush(stored);

        moderationService.purgeExpired();

        assertThat(searchService.searchMessages("owner", "pineapple"))
                .as("an expired message must not linger in the search index")
                .isEmpty();
    }
}
