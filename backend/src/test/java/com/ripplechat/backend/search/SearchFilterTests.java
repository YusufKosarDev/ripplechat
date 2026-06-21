package com.ripplechat.backend.search;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class SearchFilterTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelMembershipService membershipService;
    @Autowired
    MessageService messageService;
    @Autowired
    SearchService searchService;

    @Test
    void channelFilterRestrictsToOneChannel() {
        createUser("owner");
        var a = channelService.create(new CreateChannelRequest("a", null, false), "owner");
        var b = channelService.create(new CreateChannelRequest("b", null, false), "owner");
        messageService.send(a.id(), new CreateMessageRequest("merhaba dünya", null), "owner");
        messageService.send(b.id(), new CreateMessageRequest("merhaba evren", null), "owner");

        assertThat(searchService.searchMessages("owner", "merhaba")).hasSize(2);
        assertThat(searchService.searchMessages("owner", "merhaba", a.id(), null, null)).hasSize(1);
    }

    @Test
    void senderFilterRestrictsToOneAuthor() {
        createUser("owner");
        createUser("bob");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        membershipService.join(channel.id(), "bob");
        messageService.send(channel.id(), new CreateMessageRequest("ortak kelime", null), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("ortak kelime", null), "bob");

        assertThat(searchService.searchMessages("owner", "ortak")).hasSize(2);
        assertThat(searchService.searchMessages("owner", "ortak", null, "bob", null)).hasSize(1);
    }

    @Test
    void pagesThroughResultsAndReportsHasMore() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        // Three matching messages, paged two at a time (kept under the send rate limit).
        messageService.send(channel.id(), new CreateMessageRequest("ara birinci", null), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("ara ikinci", null), "owner");
        messageService.send(channel.id(), new CreateMessageRequest("ara üçüncü", null), "owner");

        var first = searchService.searchPage("owner", "ara", null, null, null, 0, 2);
        assertThat(first.results()).hasSize(2);
        assertThat(first.hasMore()).isTrue();

        var second = searchService.searchPage("owner", "ara", null, null, null, 1, 2);
        assertThat(second.results()).hasSize(1);
        assertThat(second.hasMore()).isFalse();
    }
}
