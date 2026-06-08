package com.ripplechat.backend.channel.membership;

import com.ripplechat.backend.channel.membership.dto.MemberResponse;
import com.ripplechat.backend.channel.membership.dto.SetRoleRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/channels/{channelId}")
@RequiredArgsConstructor
public class ChannelMembershipController {

    private final ChannelMembershipService membershipService;

    @PostMapping("/join")
    public MemberResponse join(@PathVariable UUID channelId,
                               @AuthenticationPrincipal String username) {
        return membershipService.join(channelId, username);
    }

    @DeleteMapping("/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable UUID channelId,
                      @AuthenticationPrincipal String username) {
        membershipService.leave(channelId, username);
    }

    @GetMapping("/members")
    public List<MemberResponse> members(@PathVariable UUID channelId) {
        return membershipService.listMembers(channelId);
    }

    @DeleteMapping("/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void kick(@PathVariable UUID channelId,
                     @PathVariable UUID userId,
                     @AuthenticationPrincipal String username) {
        membershipService.kick(channelId, username, userId);
    }

    @PutMapping("/members/{userId}/role")
    public MemberResponse setRole(@PathVariable UUID channelId,
                                  @PathVariable UUID userId,
                                  @RequestBody SetRoleRequest request,
                                  @AuthenticationPrincipal String username) {
        return membershipService.setRole(channelId, username, userId, request.role());
    }
}

