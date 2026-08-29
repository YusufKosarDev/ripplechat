package com.ripplechat.backend.e2ee;

import com.ripplechat.backend.channel.membership.ChannelMembershipGuard;
import com.ripplechat.backend.common.exception.BadRequestException;
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

    /** A sender publishes one wrapped key per recipient; bound it to the largest sane channel. */
    private static final int MAX_RECIPIENTS = 500;

    private final GroupSenderKeyRepository groupSenderKeyRepository;
    private final UserRepository userRepository;
    private final ChannelMembershipGuard membershipGuard;

    /**
     * Publishes this sender's group key, wrapped once per recipient.
     *
     * <p>Membership is checked: without it any authenticated user could write
     * sender-key rows into a channel they have nothing to do with. The whole set
     * is replaced each time, so the client always uploads the full recipient list
     * — that is also what lets a member who joined later receive the key.
     */
    @Transactional
    public void uploadGroupKeys(String senderUsername, UUID channelId, List<Map<String, String>> keys) {
        membershipGuard.requireMember(channelId, senderUsername);
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (keys != null && keys.size() > MAX_RECIPIENTS) {
            throw new BadRequestException("at most " + MAX_RECIPIENTS + " recipients per upload");
        }

        // Delete old keys for this sender and channel to support rotation
        groupSenderKeyRepository.deleteByChannelIdAndSenderId(channelId, sender.getId());
        if (keys == null || keys.isEmpty()) {
            return;
        }

        for (Map<String, String> keyEntry : keys) {
            UUID recipientId = parseRecipientId(keyEntry.get("recipientId"));
            String encryptedKey = keyEntry.get("encryptedKey");
            if (encryptedKey == null || encryptedKey.isBlank()) {
                throw new BadRequestException("encryptedKey is required for every recipient");
            }

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
        membershipGuard.requireMember(channelId, recipientUsername);
        User recipient = userRepository.findByUsername(recipientUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return groupSenderKeyRepository.findByChannelIdAndRecipientId(channelId, recipient.getId());
    }

    /** A malformed id is the caller's mistake, not a server error. */
    private static UUID parseRecipientId(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("recipientId is required for every recipient");
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("recipientId is not a valid id: " + raw);
        }
    }
}
