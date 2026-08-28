package com.ripplechat.backend.message.scheduled;

import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.channel.ChannelService;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScheduledMessageTests extends AbstractIntegrationTest {

    @Autowired
    ScheduledMessageService service;
    @Autowired
    ScheduledMessageRepository repository;
    @Autowired
    ChannelService channelService;
    @Autowired
    ChannelRepository channelRepository;
    @Autowired
    ChannelMembershipService membershipService;

    @Test
    void schedulesListsAndCancels() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");

        var scheduled = service.schedule(channel.id(), "owner",
                new ScheduleMessageRequest("yarın", Instant.now().plusSeconds(3600)));
        assertThat(scheduled.content()).isEqualTo("yarın");
        assertThat(service.listMine("owner")).hasSize(1);

        service.cancel(scheduled.id(), "owner");
        assertThat(service.listMine("owner")).isEmpty();
    }

    @Test
    void anUndeliverableMessageIsAbandonedInsteadOfRetriedForever() {
        createUser("owner");
        createUser("leaver");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");
        membershipService.join(channel.id(), "leaver");
        var scheduled = service.schedule(channel.id(), "leaver",
                new ScheduleMessageRequest("hoşça kal", Instant.now().plusSeconds(3600)));

        // Once the author leaves, the send can never succeed: it used to throw on
        // every 30-second sweep and come back due, for ever.
        membershipService.leave(channel.id(), "leaver");
        assertThat(service.listMine("leaver")).hasSize(1);
        for (int attempt = 0; attempt < 5; attempt++) {
            service.recordFailedDelivery(scheduled.id(), "not a member of channel");
        }

        ScheduledMessage after = repository.findById(scheduled.id()).orElseThrow();
        assertThat(after.getAttempts()).isEqualTo(5);
        assertThat(after.getLastError()).contains("not a member");
        assertThat(after.isSent()).isTrue(); // retired: out of the due query
        assertThat(service.listMine("leaver")).isEmpty();
    }

    @Test
    void rejectsPastTimeAndNonMembers() {
        createUser("owner");
        createUser("outsider");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");

        assertThatThrownBy(() -> service.schedule(channel.id(), "owner",
                new ScheduleMessageRequest("x", Instant.now().minusSeconds(60))))
                .isInstanceOf(BadRequestException.class);

        assertThatThrownBy(() -> service.schedule(channel.id(), "outsider",
                new ScheduleMessageRequest("x", Instant.now().plusSeconds(60))))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void dispatcherDeliversDueMessages() {
        createUser("owner");
        var channel = channelService.create(new CreateChannelRequest("genel", null, false), "owner");

        // A row that is already due — inserted directly to bypass the future-time guard.
        ScheduledMessage sm = new ScheduledMessage();
        sm.setChannel(channelRepository.findById(channel.id()).orElseThrow());
        sm.setSender(userRepository.findByUsername("owner").orElseThrow());
        sm.setContent("zamanı geldi");
        sm.setScheduledAt(Instant.now().minusSeconds(5));
        repository.saveAndFlush(sm);

        assertThat(service.findDueIds()).contains(sm.getId());
        service.deliver(sm.getId());

        // sent only flips if the underlying send succeeded, so this proves delivery.
        assertThat(repository.findById(sm.getId()).orElseThrow().isSent()).isTrue();
        assertThat(service.listMine("owner")).isEmpty();
    }
}
