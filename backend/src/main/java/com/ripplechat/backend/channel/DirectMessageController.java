package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.DirectChannelResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/dm")
@RequiredArgsConstructor
public class DirectMessageController {

    private final DirectMessageService directMessageService;

    @GetMapping
    public List<DirectChannelResponse> list(@AuthenticationPrincipal String username) {
        return directMessageService.listForUser(username);
    }

    /** Opens (or creates) the direct message with the given user. */
    @PostMapping("/{userId}")
    public DirectChannelResponse open(@PathVariable UUID userId,
                                      @AuthenticationPrincipal String username) {
        return directMessageService.openOrCreate(username, userId);
    }
}
