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

        CodeRequest request = new CodeRequest("000000");

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
}
