package com.ripplechat.backend.poll;

import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.poll.dto.CreatePollRequest;
import com.ripplechat.backend.poll.dto.PollResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class PollService {

    private static final int MAX_OPTIONS = 10;
    private static final int MAX_QUESTION_LENGTH = 300;
    private static final int MAX_OPTION_LENGTH = 100;

    private final PollStore store;
    private final ChannelMembershipService membershipService;
    private final SimpMessagingTemplate messagingTemplate;

    public void createPoll(UUID channelId, String username, CreatePollRequest request) {
        requireMember(channelId, username);

        String question = request.question() == null ? "" : request.question().trim();
        if (question.length() > MAX_QUESTION_LENGTH) {
            question = question.substring(0, MAX_QUESTION_LENGTH);
        }
        List<String> optionTexts = request.options() == null ? List.of()
                : request.options().stream()
                        .map(s -> s == null ? "" : s.trim())
                        .filter(s -> !s.isEmpty())
                        .map(s -> s.length() > MAX_OPTION_LENGTH ? s.substring(0, MAX_OPTION_LENGTH) : s)
                        .limit(MAX_OPTIONS)
                        .toList();

        // Frontend validates; silently ignore malformed polls instead of erroring the WS frame.
        if (question.isEmpty() || optionTexts.size() < 2) {
            return;
        }

        List<Poll.Option> options = IntStream.range(0, optionTexts.size())
                .mapToObj(i -> new Poll.Option(String.valueOf(i), optionTexts.get(i)))
                .toList();

        Poll poll = new Poll(channelId, question, options, username);
        store.save(poll);
        broadcast(poll);
    }

    public void vote(UUID channelId, UUID pollId, String username, String optionId) {
        requireMember(channelId, username);
        Poll poll = store.get(pollId);
        if (poll == null || !poll.getChannelId().equals(channelId)) {
            throw new ResourceNotFoundException("poll not found: " + pollId);
        }
        poll.vote(username, optionId);
        broadcast(poll);
    }

    public List<PollResponse> listActive(UUID channelId, String username) {
        requireMember(channelId, username);
        return store.byChannel(channelId).stream().map(PollResponse::from).toList();
    }

    private void broadcast(Poll poll) {
        messagingTemplate.convertAndSend(
                "/topic/channels/" + poll.getChannelId() + "/polls", PollResponse.from(poll));
    }

    private void requireMember(UUID channelId, String username) {
        if (!membershipService.isMember(channelId, username)) {
            throw new ForbiddenException("not a member of channel: " + channelId);
        }
    }
}
