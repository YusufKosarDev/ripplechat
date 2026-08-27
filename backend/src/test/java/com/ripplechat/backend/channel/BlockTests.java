package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.message.MessageQueryService;
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
import com.ripplechat.backend.notification.NotificationService;

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
    @Autowired
    MessageQueryService messageQueryService;
    @Autowired
    NotificationService notificationService;

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

        var aliceFeed = messageQueryService.findByChannel(channel.id(), "alice", PageRequest.of(0, 50));
        assertThat(aliceFeed.content()).isEmpty();

        var bobFeed = messageQueryService.findByChannel(channel.id(), "bob", PageRequest.of(0, 50));
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

    @Test
    void blockedSenderCannotSendMessageOrForwardToDm() {
        createUser("alice");
        User bob = createUser("bob");

        // First open direct channel so we have a channelId
        var dm = directMessageService.openOrCreate("alice", bob.getId());
        
        // Alice blocks Bob
        blockService.block("alice", bob.getId());

        // Bob tries to send a message to the DM channel -> should throw ForbiddenException
        assertThatThrownBy(() -> messageService.send(dm.id(), new CreateMessageRequest("hello", null), "bob"))
                .isInstanceOf(ForbiddenException.class);

        // Bob tries to forward a message to the DM channel -> should throw ForbiddenException
        var publicChannel = channelService.create(new CreateChannelRequest("pub", null, false), "alice");
        membershipService.join(publicChannel.id(), "bob");
        var msg = messageService.send(publicChannel.id(), new CreateMessageRequest("to-forward", null), "bob");

        assertThatThrownBy(() -> messageService.forward(dm.id(), msg.id(), "bob"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void blockedRepliesAreHiddenFromThreads() {
        createUser("alice");
        User bob = createUser("bob");
        var channel = channelService.create(new CreateChannelRequest("c2", null, false), "alice");
        membershipService.join(channel.id(), "bob");

        // Alice sends parent message
        var parent = messageService.send(channel.id(), new CreateMessageRequest("parent", null), "alice");

        // Bob replies
        messageService.send(channel.id(), new CreateMessageRequest("reply", parent.id()), "bob");

        // Verify thread has 1 reply
        var repliesBefore = messageQueryService.listThread(channel.id(), parent.id(), "alice");
        assertThat(repliesBefore).hasSize(1);

        // Alice blocks Bob
        blockService.block("alice", bob.getId());

        // Verify thread now hides the reply from Alice's view
        var repliesAfterAlice = messageQueryService.listThread(channel.id(), parent.id(), "alice");
        assertThat(repliesAfterAlice).isEmpty();

        // Verify Bob can still see his reply
        var repliesAfterBob = messageQueryService.listThread(channel.id(), parent.id(), "bob");
        assertThat(repliesAfterBob).hasSize(1);
    }

    @Test
    void blockedSenderDoesNotGenerateNotification() {
        createUser("alice");
        User bob = createUser("bob");
        var channel = channelService.create(new CreateChannelRequest("c3", null, false), "alice");
        membershipService.join(channel.id(), "bob");

        // Alice blocks Bob
        blockService.block("alice", bob.getId());

        // Bob @mentions alice
        messageService.send(channel.id(), new CreateMessageRequest("hello @alice", null), "bob");

        // Verify Alice has no notifications
        var aliceNotifications = notificationService.list("alice", PageRequest.of(0, 50));
        assertThat(aliceNotifications.content()).isEmpty();
    }
}
