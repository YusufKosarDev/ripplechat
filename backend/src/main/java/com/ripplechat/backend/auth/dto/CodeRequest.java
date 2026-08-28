package com.ripplechat.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A TOTP code plus the account password.
 *
 * <p>The password is what stops a stolen session from turning two-factor auth
 * off: a valid access token used to be enough on its own, which made 2FA
 * removable by exactly the attacker it exists to stop. It is optional in the
 * shape because accounts created through Google have no local password to
 * confirm — the controller decides.
 */
public record CodeRequest(
        @NotBlank(message = "Code is required")
        @Size(min = 6, max = 6, message = "Code must be 6 digits")
        String code,

        String password
) {
}
