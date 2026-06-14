package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.message.MessageService;
import com.ripplechat.backend.message.dto.CreateMessageRequest;
import com.ripplechat.backend.message.dto.MessageResponse;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.BlockService;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.dto.UserSummary;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BlockTests extends AbstractIntegrationTest {

    @Autowired
    BlockService blockService;
    @Autowired
    DirectMessageService directMessageService;
    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelMembershipService membershipService;
    @Autowired
    MessageService messageService;

    @Test
    void blockedUsersCannotOpenADmEitherWay() {
        createUser("alice");
        User bob = createUser("bob");
        User aliceUser = userRepository.findByUsername("alice").orElseThrow();
        blockService.block("alice", bob.getId());

        assertThatThrownBy(() -> directMessageService.openOrCreate("alice", bob.getId()))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> directMessageService.openOrCreate("bob", aliceUser.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void blockedSenderMessagesAreHiddenFromTheBlockersFeed() {
        createUser("alice");
        User bob = createUser("bob");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "alice");
        membershipService.join(channel.id(), "bob");
        messageService.send(channel.id(), new CreateMessageRequest("merhaba", null), "bob");

        blockService.block("alice", bob.getId());

        var aliceFeed = messageService.findByChannel(channel.id(), "alice", PageRequest.of(0, 50));
        assertThat(aliceFeed.content()).isEmpty();

        var bobFeed = messageService.findByChannel(channel.id(), "bob", PageRequest.of(0, 50));
        assertThat(bobFeed.content()).hasSize(1);
    }

    @Test
    void listAndUnblock() {
        createUser("alice");
        User bob = createUser("bob");
        blockService.block("alice", bob.getId());
        assertThat(blockService.listBlocked("alice")).extracting(UserSummary::username).containsExactly("bob");

        blockService.unblock("alice", bob.getId());
        assertThat(blockService.listBlocked("alice")).isEmpty();
    }
}
