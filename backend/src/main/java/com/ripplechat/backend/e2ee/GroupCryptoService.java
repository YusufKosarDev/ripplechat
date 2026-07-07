package com.ripplechat.backend.e2ee;

import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GroupCryptoService {

    private final GroupSenderKeyRepository groupSenderKeyRepository;
    private final UserRepository userRepository;

    @Transactional
    public void uploadGroupKeys(String senderUsername, UUID channelId, List<Map<String, String>> keys) {
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Delete old keys for this sender and channel to support rotation
        groupSenderKeyRepository.deleteByChannelIdAndSenderId(channelId, sender.getId());

        for (Map<String, String> keyEntry : keys) {
            UUID recipientId = UUID.fromString(keyEntry.get("recipientId"));
            String encryptedKey = keyEntry.get("encryptedKey");

            GroupSenderKey groupSenderKey = new GroupSenderKey();
            groupSenderKey.setChannelId(channelId);
            groupSenderKey.setSenderId(sender.getId());
            groupSenderKey.setRecipientId(recipientId);
            groupSenderKey.setEncryptedKey(encryptedKey);

            groupSenderKeyRepository.save(groupSenderKey);
        }
    }

    @Transactional(readOnly = true)
    public List<GroupSenderKey> getGroupKeysForChannel(String recipientUsername, UUID channelId) {
        User recipient = userRepository.findByUsername(recipientUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return groupSenderKeyRepository.findByChannelIdAndRecipientId(channelId, recipient.getId());
    }
}
