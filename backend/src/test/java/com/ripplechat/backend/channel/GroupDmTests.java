package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.DirectChannelResponse;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.dto.UserSummary;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GroupDmTests extends AbstractIntegrationTest {

    @Autowired
    DirectMessageService directMessageService;

    @Test
    void createsAGroupWithAllMembersAndListsIt() {
        createUser("alice");
        User bob = createUser("bob");
        User carol = createUser("carol");

        DirectChannelResponse group = directMessageService.createGroup(
                "alice", List.of(bob.getId(), carol.getId()), "Ekip");

        assertThat(group.group()).isTrue();
        assertThat(group.name()).isEqualTo("Ekip");
        // participants are the *other* members from alice's perspective
        assertThat(group.participants()).extracting(UserSummary::username)
                .containsExactlyInAnyOrder("bob", "carol");

        var bobDms = directMessageService.listForUser("bob");
        assertThat(bobDms).hasSize(1);
        assertThat(bobDms.get(0).group()).isTrue();
        assertThat(bobDms.get(0).participants()).extracting(UserSummary::username)
                .containsExactlyInAnyOrder("alice", "carol");
    }

    @Test
    void groupNeedsAtLeastOneOtherMember() {
        createUser("alice");
        assertThatThrownBy(() -> directMessageService.createGroup("alice", List.of(), null))
                .isInstanceOf(BadRequestException.class);
    }
}
