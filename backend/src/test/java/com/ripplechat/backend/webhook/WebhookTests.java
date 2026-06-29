package com.ripplechat.backend.webhook;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebhookTests extends AbstractIntegrationTest {

    @Autowired
    WebhookService webhookService;
    @Autowired
    ChannelService channelService;
    @Autowired
    UserService userService;
    @Autowired
    MessageRepository messageRepository;

    @Test
    void createReturnsOneTimeUrlAndIngestPostsAMessage() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");

        var webhook = webhookService.create(channel.id(), "owner", new CreateWebhookRequest("CI Bot"));
        assertThat(webhook.url()).startsWith("/api/hooks/");
        assertThat(webhook.name()).isEqualTo("CI Bot");

        String token = webhook.url().substring("/api/hooks/".length());
        webhookService.ingest(token, new WebhookIngestRequest("build passed ✅"));

        assertThat(messageRepository.findAll())
                .anyMatch(m -> "build passed ✅".equals(m.getContent()));
    }

    @Test
    void invalidTokenIsRejected() {
        assertThatThrownBy(() -> webhookService.ingest("not-a-real-token", new WebhookIngestRequest("x")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void onlyModeratorsCanCreateWebhooks() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");

        assertThatThrownBy(() -> webhookService.create(channel.id(), "outsider", new CreateWebhookRequest("x")))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void botUsersAreHiddenFromPeopleSearch() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");
        webhookService.create(channel.id(), "owner", new CreateWebhookRequest("SearchBot"));

        assertThat(userService.search("SearchBot", "owner")).isEmpty();
        assertThat(userService.search("hook", "owner")).isEmpty();
    }
}
