package com.ripplechat.backend.poll;

import com.ripplechat.backend.support.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Verifies the JPA mapping: options and votes round-trip through the database. */
class PollPersistenceTests extends AbstractIntegrationTest {

    @Autowired
    PollRepository pollRepository;
    @Autowired
    EntityManager entityManager;

    @Test
    void persistsOptionsAndVotesAndDerivesCounts() {
        Poll poll = new Poll(UUID.randomUUID(), "Best language?", "alice");
        poll.addOption("0", "Java", 0);
        poll.addOption("1", "Kotlin", 1);
        poll.vote("alice", "0");
        poll.vote("bob", "1");
        poll.vote("bob", "0"); // bob changes his vote
        UUID id = pollRepository.save(poll).getId();

        // Force a real round trip rather than reading back the managed instance.
        entityManager.flush();
        entityManager.clear();

        Poll loaded = pollRepository.findById(id).orElseThrow();
        assertThat(loaded.getOptions()).extracting(PollOption::getText)
                .containsExactly("Java", "Kotlin"); // @OrderBy(position) preserved
        assertThat(loaded.totalVotes()).isEqualTo(2); // one row per user
        assertThat(loaded.countFor("0")).isEqualTo(2); // alice + bob (changed)
        assertThat(loaded.countFor("1")).isZero();
    }

    @Test
    void listsOnlyTheGivenChannelsPolls() {
        UUID channelId = UUID.randomUUID();
        pollRepository.save(buildPoll(channelId, "First"));
        pollRepository.save(buildPoll(channelId, "Second"));
        pollRepository.save(buildPoll(UUID.randomUUID(), "Other channel"));
        entityManager.flush();
        entityManager.clear();

        var polls = pollRepository.findByChannelIdOrderByCreatedAtAsc(channelId);
        assertThat(polls).extracting(Poll::getQuestion).containsExactlyInAnyOrder("First", "Second");
    }

    private Poll buildPoll(UUID channelId, String question) {
        Poll poll = new Poll(channelId, question, "alice");
        poll.addOption("0", "A", 0);
        poll.addOption("1", "B", 1);
        return poll;
    }
}
