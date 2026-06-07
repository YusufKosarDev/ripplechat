package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/channels")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChannelResponse create(@Valid @RequestBody CreateChannelRequest request,
                                  @AuthenticationPrincipal String username) {
        return channelService.create(request, username);
    }

    @GetMapping
    public List<ChannelResponse> findAll(@AuthenticationPrincipal String username) {
        return channelService.findAll(username);
    }

    @GetMapping("/{id}")
    public ChannelResponse findById(@PathVariable UUID id,
                                    @AuthenticationPrincipal String username) {
        return channelService.findById(id, username);
    }
}
