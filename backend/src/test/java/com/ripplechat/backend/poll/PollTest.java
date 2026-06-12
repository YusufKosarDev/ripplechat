package com.ripplechat.backend.poll;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure unit tests for the vote-tallying logic — no Spring/DB. */
class PollTest {

    private Poll twoOptionPoll() {
        Poll poll = new Poll(UUID.randomUUID(), "Best language?", "alice");
        poll.addOption("0", "Java", 0);
        poll.addOption("1", "Kotlin", 1);
        return poll;
    }

    @Test
    void recordsVotesPerOption() {
        Poll poll = twoOptionPoll();
        poll.vote("alice", "0");
        poll.vote("bob", "1");

        assertThat(poll.countFor("0")).isEqualTo(1);
        assertThat(poll.countFor("1")).isEqualTo(1);
        assertThat(poll.totalVotes()).isEqualTo(2);
    }

    @Test
    void changingVoteDoesNotDoubleCount() {
        Poll poll = twoOptionPoll();
        poll.vote("alice", "0");
        poll.vote("alice", "1"); // alice changes her mind

        assertThat(poll.countFor("0")).isEqualTo(0);
        assertThat(poll.countFor("1")).isEqualTo(1);
        assertThat(poll.totalVotes()).isEqualTo(1);
    }

    @Test
    void ignoresUnknownOption() {
        Poll poll = twoOptionPoll();
        poll.vote("alice", "99");

        assertThat(poll.totalVotes()).isZero();
    }
}
