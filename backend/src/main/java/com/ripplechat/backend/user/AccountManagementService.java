package com.ripplechat.backend.user;

import com.ripplechat.backend.auth.AuthTokenRepository;
import com.ripplechat.backend.auth.RecoveryCodeRepository;
import com.ripplechat.backend.auth.RefreshTokenRepository;
import com.ripplechat.backend.auth.SecurityAuditLogger;
import com.ripplechat.backend.channel.membership.ChannelMembershipRepository;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.notification.NotificationRepository;
import com.ripplechat.backend.push.PushSubscriptionRepository;
import com.ripplechat.backend.user.dto.AccountExport;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * GDPR self-service: export a user's own data, and erase their account.
 *
 * <p>Erasure <em>anonymises</em> rather than hard-deletes the user row. The row
 * is referenced by messages, memberships, channels and reactions; deleting it
 * would break other people's conversation history. Instead all personal data is
 * scrubbed, the sign-in credentials and session/notification artifacts are
 * removed, and the account is flagged deleted so it can never sign in again — the
 * user's past messages remain, attributed to an anonymous "Deleted User".
 */
@Service
@RequiredArgsConstructor
public class AccountManagementService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MessageRepository messageRepository;
    private final ChannelMembershipRepository membershipRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuthTokenRepository authTokenRepository;
    private final RecoveryCodeRepository recoveryCodeRepository;
    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final UserBlockRepository blockRepository;
    private final NotificationRepository notificationRepository;
    private final SecurityAuditLogger audit;

    @Transactional(readOnly = true)
    public AccountExport export(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        AccountExport.Profile profile = new AccountExport.Profile(
                user.getId(), user.getUsername(), user.getEmail(), user.getDisplayName(),
                user.getAvatarColor(), user.getAvatarUrl(), user.getCreatedAt(),
                user.isEmailVerified(), user.isTwoFactorEnabled());

        var memberships = membershipRepository.findByUser_Username(username).stream()
                .map(m -> new AccountExport.Membership(
                        m.getChannel().getId(), m.getChannel().getName(),
                        m.getRole().name(), m.getJoinedAt()))
                .toList();

        var messages = messageRepository.findBySender_IdOrderByCreatedAtAsc(user.getId()).stream()
                .map(msg -> new AccountExport.AuthoredMessage(
                        msg.getId(), msg.getChannel().getId(), msg.getContent(),
                        msg.getCreatedAt(), msg.isDeleted()))
                .toList();

        return new AccountExport(Instant.now(), profile, memberships, messages);
    }

    @Transactional
    public void delete(String username, String rawPassword) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + username));

        // Local accounts must re-confirm their password; OAuth-only accounts
        // (no local password) are erased on the strength of the JWT session.
        if (user.getPassword() != null
                && (rawPassword == null || !passwordEncoder.matches(rawPassword, user.getPassword()))) {
            throw new BadRequestException("password is incorrect");
        }

        UUID id = user.getId();

        // Purge sign-in, session and notification artifacts. None of these rows are
        // referenced by anything else, so removing them is safe.
        refreshTokenRepository.deleteAllByUser(user);
        authTokenRepository.deleteByUser(user);
        recoveryCodeRepository.deleteByUser(user);
        pushSubscriptionRepository.deleteByUserId(id);
        notificationRepository.deleteByUserId(id);
        blockRepository.deleteByBlockerId(id);
        blockRepository.deleteByBlockedId(id);

        // Scrub personal data on the retained row.
        user.setUsername("deleted_" + id);
        user.setEmail("deleted+" + id + "@deleted.invalid");
        user.setDisplayName("Deleted User");
        user.setPassword(null);
        user.setAvatarUrl(null);
        user.setAvatarColor(null);
        user.setStatusEmoji(null);
        user.setStatusText(null);
        user.setStatusExpiresAt(null);
        user.setDndUntil(null);
        user.setTotpSecret(null);
        user.setTwoFactorEnabled(false);
        user.setPublicKey(null);
        user.setDeleted(true);
        user.setDeletedAt(Instant.now());
        userRepository.save(user);

        audit.accountDeleted(username);
    }
}
