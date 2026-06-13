package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.DirectChannelResponse;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserService;
import com.ripplechat.backend.user.dto.UserSummary;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DirectMessageServiceTests extends AbstractIntegrationTest {

    @Autowired
    DirectMessageService directMessageService;
    @Autowired
    ChannelService channelService;
    @Autowired
    UserService userService;

    @Test
    void openCreatesAConversationAndIsIdempotentAndSymmetric() {
        User alice = createUser("alice");
        User bob = createUser("bob");

        DirectChannelResponse first = directMessageService.openOrCreate("alice", bob.getId());
        assertThat(first.otherUser().username()).isEqualTo("bob");

        // Re-opening from either side returns the same conversation.
        DirectChannelResponse again = directMessageService.openOrCreate("alice", bob.getId());
        DirectChannelResponse fromBob = directMessageService.openOrCreate("bob", alice.getId());
        assertThat(again.id()).isEqualTo(first.id());
        assertThat(fromBob.id()).isEqualTo(first.id());
        assertThat(fromBob.otherUser().username()).isEqualTo("alice");
    }

    @Test
    void cannotDirectMessageYourself() {
        User alice = createUser("alice");
        assertThatThrownBy(() -> directMessageService.openOrCreate("alice", alice.getId()))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void listsOnlyTheUsersOwnDirectMessages() {
        createUser("alice");
        User bob = createUser("bob");
        createUser("carol");
        directMessageService.openOrCreate("alice", bob.getId());

        List<DirectChannelResponse> aliceDms = directMessageService.listForUser("alice");
        assertThat(aliceDms).hasSize(1);
        assertThat(aliceDms.get(0).otherUser().username()).isEqualTo("bob");

        assertThat(directMessageService.listForUser("carol")).isEmpty();
    }

    @Test
    void directMessagesAreNotListedAmongRegularChannels() {
        createUser("alice");
        User bob = createUser("bob");
        directMessageService.openOrCreate("alice", bob.getId());

        assertThat(channelService.findAll("alice")).isEmpty();
    }

    @Test
    void userSearchFindsOthersByPrefixAndExcludesSelf() {
        createUser("alice");
        createUser("alicia");
        createUser("bob");

        List<UserSummary> results = userService.search("ali", "alice");
        assertThat(results).extracting(UserSummary::username).containsExactly("alicia");

        // Too-short queries return nothing.
        assertThat(userService.search("a", "alice")).isEmpty();
    }
}
