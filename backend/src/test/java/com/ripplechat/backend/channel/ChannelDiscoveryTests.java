package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class ChannelDiscoveryTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelMembershipService membershipService;

    @Test
    void discoverListsPublicChannelsTheUserHasNotJoined() {
        createUser("alice");
        createUser("bob");
        ChannelResponse pub = channelService.create(new CreateChannelRequest("discover-public", null, false), "alice");
        channelService.create(new CreateChannelRequest("discover-private", null, true), "alice");

        // bob sees the public channel, never the private one.
        assertThat(channelService.discover("bob"))
                .extracting(ChannelResponse::name)
                .contains("discover-public")
                .doesNotContain("discover-private");

        // alice is already a member (creator), so it's not in her discovery list.
        assertThat(channelService.discover("alice"))
                .extracting(ChannelResponse::name)
                .doesNotContain("discover-public");

        // Once bob joins, it drops out of his discovery list too.
        membershipService.join(pub.id(), "bob");
        assertThat(channelService.discover("bob"))
                .extracting(ChannelResponse::name)
                .doesNotContain("discover-public");
    }
}
