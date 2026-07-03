package com.ripplechat.backend.admin;

import com.ripplechat.backend.admin.dto.AdminOverview;
import com.ripplechat.backend.admin.dto.AdminUserView;
import com.ripplechat.backend.admin.dto.AuditLogEntry;
import com.ripplechat.backend.channel.ChannelRepository;
import com.ripplechat.backend.common.dto.PageResponse;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.ResourceNotFoundException;
import com.ripplechat.backend.message.MessageRepository;
import com.ripplechat.backend.user.User;
import com.ripplechat.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Platform administration: user moderation and the audit trail. Every mutating
 * action is authorized against the caller's global admin flag and recorded.
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final ChannelRepository channelRepository;
    private final MessageRepository messageRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;

    /** Throws unless the caller is a global admin. Returns the admin user. */
    @Transactional(readOnly = true)
    public User requireAdmin(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ForbiddenException("admin access required"));
        if (!user.isAdmin()) {
            throw new ForbiddenException("admin access required");
        }
        return user;
    }

    @Transactional(readOnly = true)
    public AdminOverview overview(String actor) {
        requireAdmin(actor);
        return new AdminOverview(
                userRepository.count(),
                userRepository.countByAdminTrue(),
                userRepository.countByDisabledTrue(),
                userRepository.countByBotTrue(),
                channelRepository.count(),
                messageRepository.count());
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminUserView> listUsers(String actor, Pageable pageable) {
        requireAdmin(actor);
        return PageResponse.from(
                userRepository.findAllByOrderByCreatedAtDesc(pageable).map(AdminUserView::from));
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogEntry> auditLog(String actor, Pageable pageable) {
        requireAdmin(actor);
        return PageResponse.from(
                auditLogRepository.findAllByOrderByCreatedAtDesc(pageable).map(AuditLogEntry::from));
    }

    /** Grants or revokes global admin on a target user. Cannot change your own flag. */
    @Transactional
    public AdminUserView setAdmin(String actor, UUID targetId, boolean value) {
        User admin = requireAdmin(actor);
        User target = requireUser(targetId);
        if (target.getId().equals(admin.getId())) {
            throw new ForbiddenException("you cannot change your own admin status");
        }
        target.setAdmin(value);
        userRepository.save(target);
        auditService.record(actor, value ? "admin_granted" : "admin_revoked", target.getUsername(), null);
        return AdminUserView.from(target);
    }

    /** Disables (bans) or re-enables a target user. Cannot disable yourself. */
    @Transactional
    public AdminUserView setDisabled(String actor, UUID targetId, boolean value) {
        User admin = requireAdmin(actor);
        User target = requireUser(targetId);
        if (target.getId().equals(admin.getId())) {
            throw new ForbiddenException("you cannot disable your own account");
        }
        target.setDisabled(value);
        userRepository.save(target);
        auditService.record(actor, value ? "user_disabled" : "user_enabled", target.getUsername(), null);
        return AdminUserView.from(target);
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("user not found: " + id));
    }
}
