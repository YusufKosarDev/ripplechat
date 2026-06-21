package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers {@link ChannelService#findAll} (backed by the visibility query): public
 * channels are listed for everyone, private channels only for members, and
 * deleted channels never show up.
 */
class ChannelListVisibilityTests extends AbstractIntegrationTest {

    @Autowired
    ChannelService channelService;

    @Test
    void publicChannelsAreVisibleToNonMembers() {
        createUser("owner");
        createUser("outsider");
        var pub = channelService.create(new CreateChannelRequest("genel", null, false), "owner");

        assertThat(idsVisibleTo("outsider")).contains(pub.id());
    }

    @Test
    void privateChannelsAreHiddenFromNonMembersButVisibleToMembers() {
        createUser("owner");
        createUser("outsider");
        var priv = channelService.create(new CreateChannelRequest("gizli", null, true), "owner");

        assertThat(idsVisibleTo("outsider")).doesNotContain(priv.id());
        // The creator is an owner (hence a member), so the channel is visible to them.
        assertThat(idsVisibleTo("owner")).contains(priv.id());
    }

    @Test
    void deletedChannelsAreExcluded() {
        createUser("owner");
        var ch = channelService.create(new CreateChannelRequest("eski", null, false), "owner");
        channelService.delete(ch.id(), "owner");

        assertThat(idsVisibleTo("owner")).doesNotContain(ch.id());
    }

    private List<UUID> idsVisibleTo(String username) {
        return channelService.findAll(username).stream().map(ChannelResponse::id).toList();
    }
}
