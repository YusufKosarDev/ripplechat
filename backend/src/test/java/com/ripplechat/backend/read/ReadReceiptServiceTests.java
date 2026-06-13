package com.ripplechat.backend.read;

import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.read.dto.ReadReceipt;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReadReceiptServiceTests extends AbstractIntegrationTest {

    @Autowired
    ReadReceiptService readReceiptService;
    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelMembershipService membershipService;

    @Test
    void marksAndListsReadsPerMember() {
        createUser("owner");
        createUser("member");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");
        membershipService.join(channel.id(), "member");

        readReceiptService.markRead(channel.id(), "owner");
        readReceiptService.markRead(channel.id(), "member");

        List<ReadReceipt> reads = readReceiptService.listReads(channel.id(), "owner");
        assertThat(reads).hasSize(2);
        assertThat(reads).allMatch(r -> r.lastReadAt() != null && r.channelId().equals(channel.id()));
    }

    @Test
    void markReadKeepsOneRowPerUser() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        readReceiptService.markRead(channel.id(), "owner");
        readReceiptService.markRead(channel.id(), "owner"); // again — should update, not duplicate

        assertThat(readReceiptService.listReads(channel.id(), "owner")).hasSize(1);
    }

    @Test
    void nonMemberCannotMarkOrListReads() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("c", null, false), "owner");

        assertThatThrownBy(() -> readReceiptService.markRead(channel.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> readReceiptService.listReads(channel.id(), "outsider"))
                .isInstanceOf(ForbiddenException.class);
    }
}
