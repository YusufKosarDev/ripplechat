package com.ripplechat.backend.e2ee;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface GroupSenderKeyRepository extends JpaRepository<GroupSenderKey, UUID> {

    List<GroupSenderKey> findByChannelIdAndRecipientId(UUID channelId, UUID recipientId);

    void deleteByChannelIdAndSenderId(UUID channelId, UUID senderId);
}
