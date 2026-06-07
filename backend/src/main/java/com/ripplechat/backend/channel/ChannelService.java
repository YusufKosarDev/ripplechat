package com.ripplechat.backend.channel;

import com.ripplechat.backend.channel.dto.ChannelResponse;
import com.ripplechat.backend.channel.dto.CreateChannelRequest;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;

    @Transactional
    public ChannelResponse create(CreateChannelRequest request, String username) {
        User creator = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        Channel channel = new Channel();
        channel.setName(request.name());
        channel.setDescription(request.description());
        channel.setPrivate(Boolean.TRUE.equals(request.isPrivate()));
        channel.setCreatedBy(creator);

        return ChannelResponse.from(channelRepository.saveAndFlush(channel));
    }

    @Transactional(readOnly = true)
    public List<ChannelResponse> findAll() {
        return channelRepository.findAll().stream()
                .map(ChannelResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ChannelResponse findById(UUID id) {
        return channelRepository.findById(id)
                .map(ChannelResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("channel not found: " + id));
    }
}
