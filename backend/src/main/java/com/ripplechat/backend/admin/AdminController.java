package com.ripplechat.backend.admin;

import com.ripplechat.backend.admin.dto.AdminFlagRequest;
import com.ripplechat.backend.admin.dto.AdminOverview;
import com.ripplechat.backend.admin.dto.AdminUserView;
import com.ripplechat.backend.admin.dto.AuditLogEntry;
import com.ripplechat.backend.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Platform admin panel API. Every endpoint is authorized against the caller's
 * global admin flag inside {@link AdminService}.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/overview")
    public AdminOverview overview(@AuthenticationPrincipal String username) {
        return adminService.overview(username);
    }

    @GetMapping("/users")
    public PageResponse<AdminUserView> users(
            @AuthenticationPrincipal String username,
            @PageableDefault(size = 25, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return adminService.listUsers(username, pageable);
    }

    @GetMapping("/audit")
    public PageResponse<AuditLogEntry> audit(
            @AuthenticationPrincipal String username,
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return adminService.auditLog(username, pageable);
    }

    @PostMapping("/users/{id}/admin")
    public AdminUserView setAdmin(@PathVariable UUID id,
                                  @RequestBody AdminFlagRequest request,
                                  @AuthenticationPrincipal String username) {
        return adminService.setAdmin(username, id, request.value());
    }

    @PostMapping("/users/{id}/disabled")
    public AdminUserView setDisabled(@PathVariable UUID id,
                                     @RequestBody AdminFlagRequest request,
                                     @AuthenticationPrincipal String username) {
        return adminService.setDisabled(username, id, request.value());
    }
}
