package com.ripplechat.backend.poll;

import com.ripplechat.backend.poll.dto.PollResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/channels/{channelId}/polls")
public class PollRestController {

    private final PollService pollService;

    public PollRestController(PollService pollService) {
        this.pollService = pollService;
    }

    /** Active polls for a channel — used to rehydrate on load/reconnect. */
    @GetMapping
    public List<PollResponse> list(@PathVariable UUID channelId,
                                   @AuthenticationPrincipal String username) {
        return pollService.listActive(channelId, username);
    }
}
