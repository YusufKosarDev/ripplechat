package com.ripplechat.backend.poll;

import com.ripplechat.backend.poll.dto.CreatePollRequest;
import com.ripplechat.backend.poll.dto.VoteRequest;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

@Controller
public class PollWsController {

    private final PollService pollService;

    public PollWsController(PollService pollService) {
        this.pollService = pollService;
    }

    @MessageMapping("/channels/{channelId}/poll")
    public void create(@DestinationVariable UUID channelId,
                       @Payload CreatePollRequest request,
                       Principal principal) {
        pollService.createPoll(channelId, principal.getName(), request);
    }

    @MessageMapping("/channels/{channelId}/poll/{pollId}/vote")
    public void vote(@DestinationVariable UUID channelId,
                     @DestinationVariable UUID pollId,
                     @Payload VoteRequest request,
                     Principal principal) {
        pollService.vote(channelId, pollId, principal.getName(), request.optionId());
    }
}
