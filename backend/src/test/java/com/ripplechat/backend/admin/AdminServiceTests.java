package com.ripplechat.backend.admin;

import com.ripplechat.backend.admin.dto.AdminUserView;
import com.ripplechat.backend.auth.RefreshTokenService;
import com.ripplechat.backend.common.exception.ForbiddenException;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminServiceTests extends AbstractIntegrationTest {

    @Autowired
    AdminService adminService;
    @Autowired
    RefreshTokenService refreshTokenService;

    private User makeAdmin(String username) {
        User u = createUser(username);
        u.setAdmin(true);
        return userRepository.saveAndFlush(u);
    }

    @Test
    void nonAdminIsForbidden() {
        createUser("bob");
        assertThatThrownBy(() -> adminService.overview("bob"))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> adminService.listUsers("bob", PageRequest.of(0, 10)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void adminSeesOverviewAndUsers() {
        makeAdmin("root");
        // The overview counts every row in the database, and the integration
        // tests share one PostgreSQL container: any class that commits a user
        // outside its rollback shifts the absolute totals, and class execution
        // order is not fixed. Assert on the delta this test causes instead.
        var before = adminService.overview("root");

        createUser("bob");
        var after = adminService.overview("root");

        assertThat(after.totalUsers()).isEqualTo(before.totalUsers() + 1);
        assertThat(after.admins()).isEqualTo(before.admins());

        // Ordered newest-first, so the two users just created are on page 0.
        assertThat(adminService.listUsers("root", PageRequest.of(0, 10)).content())
                .extracting(AdminUserView::username)
                .contains("root", "bob");
    }

    @Test
    void grantingAdminIsRecordedInAudit() {
        makeAdmin("root");
        User bob = createUser("bob");

        AdminUserView updated = adminService.setAdmin("root", bob.getId(), true);
        assertThat(updated.admin()).isTrue();
        assertThat(userRepository.findByUsername("bob").orElseThrow().isAdmin()).isTrue();

        assertThat(adminService.auditLog("root", PageRequest.of(0, 10)).content())
                .anySatisfy(entry -> {
                    assertThat(entry.action()).isEqualTo("admin_granted");
                    assertThat(entry.actor()).isEqualTo("root");
                    assertThat(entry.target()).isEqualTo("bob");
                });
    }

    @Test
    void disablingUserIsRecordedAndReversible() {
        makeAdmin("root");
        User bob = createUser("bob");

        adminService.setDisabled("root", bob.getId(), true);
        assertThat(userRepository.findByUsername("bob").orElseThrow().isDisabled()).isTrue();

        adminService.setDisabled("root", bob.getId(), false);
        assertThat(userRepository.findByUsername("bob").orElseThrow().isDisabled()).isFalse();

        assertThat(adminService.auditLog("root", PageRequest.of(0, 10)).content())
                .extracting(e -> e.action())
                .contains("user_disabled", "user_enabled");
    }

    @Test
    void disablingAUserEndsTheirSessionsAndBlocksRefresh() {
        makeAdmin("root");
        User bob = createUser("bob");
        refreshTokenService.issue(bob);
        assertThat(refreshTokenService.getActiveSessions(bob)).isNotEmpty();

        adminService.setDisabled("root", bob.getId(), true);

        // The ban revoked every live session immediately.
        assertThat(refreshTokenService.getActiveSessions(bob)).isEmpty();

        // And even a freshly-minted token cannot be rotated while disabled — the
        // rotate() guard rejects it (defence in depth beyond the login block).
        String survivor = refreshTokenService.issue(bob);
        assertThatThrownBy(() -> refreshTokenService.rotate(survivor))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThat(refreshTokenService.getActiveSessions(bob)).isEmpty();
    }

    @Test
    void adminCannotDemoteOrDisableSelf() {
        User root = makeAdmin("root");
        assertThatThrownBy(() -> adminService.setAdmin("root", root.getId(), false))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> adminService.setDisabled("root", root.getId(), true))
                .isInstanceOf(ForbiddenException.class);
    }
}
