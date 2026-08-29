package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.CodeRequest;
import com.ripplechat.backend.common.exception.BadRequestException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TwoFactorControllerTests extends AbstractIntegrationTest {

    @Autowired
    private TwoFactorController twoFactorController;

    @Test
    void twoFactorOperationsAreThrottled() {
        createUser("twofamanage");
        User user = userRepository.findByUsername("twofamanage").orElseThrow();
        user.setTwoFactorEnabled(true);
        user.setTotpSecret("ABCDEFGHIJKLMNOP");
        userRepository.saveAndFlush(user);

        CodeRequest request = new CodeRequest("000000", "password123");

        // The first 5 attempts to disable 2FA fail on the code itself (throw BadRequestException)
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> twoFactorController.disable2Fa("twofamanage", request))
                    .isInstanceOf(BadRequestException.class);
        }

        // The 6th attempt is throttled with 429 ResponseStatusException
        assertThatThrownBy(() -> twoFactorController.disable2Fa("twofamanage", request))
                .isInstanceOf(ResponseStatusException.class)
                .matches(ex -> ((ResponseStatusException) ex).getStatusCode().value() == 429);
    }

    @Test
    void disablingTwoFactorRequiresThePassword() {
        createUser("twofapw");
        User user = userRepository.findByUsername("twofapw").orElseThrow();
        user.setTwoFactorEnabled(true);
        user.setTotpSecret("ABCDEFGHIJKLMNOP");
        userRepository.saveAndFlush(user);

        // A stolen access token alone used to be enough to strip the second
        // factor off the account.
        assertThatThrownBy(() -> twoFactorController.disable2Fa("twofapw", new CodeRequest("000000", null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("password");
        assertThatThrownBy(() -> twoFactorController.disable2Fa("twofapw", new CodeRequest("000000", "wrong-password")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("password");

        // With the right password it gets as far as the code check.
        assertThatThrownBy(() -> twoFactorController.disable2Fa("twofapw", new CodeRequest("000000", "password123")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("2FA code");
    }
}
