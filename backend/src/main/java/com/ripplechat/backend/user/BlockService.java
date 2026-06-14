package com.ripplechat.backend.user;

import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.user.dto.UserSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BlockService {

    private final UserBlockRepository blockRepository;
    private final UserRepository userRepository;

    @Transactional
    public void block(String blockerUsername, UUID targetId) {
        User me = resolve(blockerUsername);
        if (me.getId().equals(targetId)) {
            throw new BadRequestException("cannot block yourself");
        }
        if (!userRepository.existsById(targetId)) {
            throw new ResourceNotFoundException("user not found: " + targetId);
        }
        if (!blockRepository.existsByBlockerIdAndBlockedId(me.getId(), targetId)) {
            UserBlock block = new UserBlock();
            block.setBlockerId(me.getId());
            block.setBlockedId(targetId);
            blockRepository.save(block);
        }
    }

    @Transactional
    public void unblock(String blockerUsername, UUID targetId) {
        blockRepository.deleteByBlockerIdAndBlockedId(resolve(blockerUsername).getId(), targetId);
    }

    @Transactional(readOnly = true)
    public List<UserSummary> listBlocked(String username) {
        List<UUID> ids = blockRepository.findByBlockerId(resolve(username).getId()).stream()
                .map(UserBlock::getBlockedId)
                .toList();
        return userRepository.findAllById(ids).stream().map(UserSummary::from).toList();
    }

    /** True if either user has blocked the other. */
    @Transactional(readOnly = true)
    public boolean blockedBetween(UUID a, UUID b) {
        return blockRepository.existsByBlockerIdAndBlockedId(a, b)
                || blockRepository.existsByBlockerIdAndBlockedId(b, a);
    }

    private User resolve(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));
    }
}
