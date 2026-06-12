package com.ripplechat.backend.poll;

import com.ripplechat.backend.channel.membership.ChannelMembershipService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.poll.dto.CreatePollRequest;
import com.ripplechat.backend.poll.dto.PollResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PollService {

    private static final int MAX_OPTIONS = 10;
    private static final int MAX_QUESTION_LENGTH = 300;
    private static final int MAX_OPTION_LENGTH = 100;

    private final PollRepository pollRepository;
    private final ChannelMembershipService membershipService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
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

        Poll poll = new Poll(channelId, question, username);
        for (int i = 0; i < optionTexts.size(); i++) {
            poll.addOption(String.valueOf(i), optionTexts.get(i), i);
        }
        pollRepository.save(poll);
        broadcast(poll);
    }

    @Transactional
    public void vote(UUID channelId, UUID pollId, String username, String optionId) {
        requireMember(channelId, username);
        Poll poll = pollRepository.findById(pollId).orElse(null);
        if (poll == null || !poll.getChannelId().equals(channelId)) {
            throw new ResourceNotFoundException("poll not found: " + pollId);
        }
        poll.vote(username, optionId);
        broadcast(poll); // flushed at commit via dirty checking
    }

    @Transactional(readOnly = true)
    public List<PollResponse> listActive(UUID channelId, String username) {
        requireMember(channelId, username);
        return pollRepository.findByChannelIdOrderByCreatedAtAsc(channelId).stream()
                .map(PollResponse::from).toList();
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
