package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.CreateGroupRequest;
import com.ripplechat.backend.channel.dto.DirectChannelResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    /** Creates a multi-party group DM. (Literal path takes precedence over /{userId}.) */
    @PostMapping("/group")
    public DirectChannelResponse createGroup(@Valid @RequestBody CreateGroupRequest request,
                                             @AuthenticationPrincipal String username) {
        return directMessageService.createGroup(username, request.userIds(), request.name());
    }

    /** Opens (or creates) the direct message with the given user. */
    @PostMapping("/{userId}")
    public DirectChannelResponse open(@PathVariable UUID userId,
                                      @AuthenticationPrincipal String username) {
        return directMessageService.openOrCreate(username, userId);
    }
}
