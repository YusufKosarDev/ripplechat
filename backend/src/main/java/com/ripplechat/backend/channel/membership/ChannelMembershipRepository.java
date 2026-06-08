package com.ripplechat.backend.channel.membership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannelMembershipRepository extends JpaRepository<ChannelMembership, UUID> {

    boolean existsByChannelIdAndUser_Username(UUID channelId, String username);

    Optional<ChannelMembership> findByChannelIdAndUser_Username(UUID channelId, String username);

    Optional<ChannelMembership> findByChannelIdAndUser_Id(UUID channelId, UUID userId);

    List<ChannelMembership> findByChannelId(UUID channelId);

    List<ChannelMembership> findByUser_Username(String username);

    long countByChannelId(UUID channelId);
}
