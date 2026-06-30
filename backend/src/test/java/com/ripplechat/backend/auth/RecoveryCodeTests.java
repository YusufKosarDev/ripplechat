package com.ripplechat.backend.auth;

import com.ripplechat.backend.auth.dto.AuthResponse;
import com.ripplechat.backend.auth.dto.Verify2FaRequest;
import com.ripplechat.backend.common.exception.InvalidCredentialsException;
import com.ripplechat.backend.support.AbstractIntegrationTest;
import com.ripplechat.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RecoveryCodeTests extends AbstractIntegrationTest {

    @Autowired
    RecoveryCodeService recoveryCodeService;
    @Autowired
    TwoFactorService twoFactorService;
    @Autowired
    JwtService jwtService;
    @Autowired
    AuthService authService;

    @Test
    void generateProducesSingleUseCodesAndRegenerationInvalidatesOldOnes() {
        User user = createUser("alice");

        List<String> codes = recoveryCodeService.generate(user);
        assertThat(codes).hasSize(10);
        assertThat(codes).allMatch(c -> c.matches("[a-z0-9]{5}-[a-z0-9]{5}"));
        assertThat(recoveryCodeService.remaining(user)).isEqualTo(10);

        // A code works once, then is spent.
        assertThat(recoveryCodeService.consumeIfValid(user, codes.get(0))).isTrue();
        assertThat(recoveryCodeService.remaining(user)).isEqualTo(9);
        assertThat(recoveryCodeService.consumeIfValid(user, codes.get(0))).isFalse();

        // Garbage and the un-grouped/upper-case form are handled.
        assertThat(recoveryCodeService.consumeIfValid(user, "not-a-real-code")).isFalse();
        assertThat(recoveryCodeService.consumeIfValid(user, codes.get(1).replace("-", "").toUpperCase())).isTrue();

        // Regenerating drops the previous batch.
        List<String> regenerated = recoveryCodeService.generate(user);
        assertThat(recoveryCodeService.consumeIfValid(user, codes.get(2))).isFalse();
        assertThat(recoveryCodeService.consumeIfValid(user, regenerated.get(0))).isTrue();
    }

    @Test
    void recoveryCodeCompletesTheTwoFactorLoginStepOnceEach() {
        User user = createUser("twofa");
        user.setTwoFactorEnabled(true);
        user.setTotpSecret(twoFactorService.generateNewSecret());
        userRepository.saveAndFlush(user);
        List<String> codes = recoveryCodeService.generate(user);

        // A recovery code stands in for the TOTP code at the second-factor step.
        String preAuth = jwtService.generatePreAuthToken("twofa");
        AuthResponse res = authService.verify2FaLogin(new Verify2FaRequest(preAuth, codes.get(0)));
        assertThat(res.accessToken()).isNotNull();

        // The same code can't be replayed.
        String preAuth2 = jwtService.generatePreAuthToken("twofa");
        assertThatThrownBy(() -> authService.verify2FaLogin(new Verify2FaRequest(preAuth2, codes.get(0))))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThat(recoveryCodeService.remaining(user)).isEqualTo(9);
    }
}
