package com.ripplechat.backend.read;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannelReadRepository extends JpaRepository<ChannelRead, UUID> {

    Optional<ChannelRead> findByChannelIdAndUserId(UUID channelId, UUID userId);

    List<ChannelRead> findByChannelId(UUID channelId);
}
