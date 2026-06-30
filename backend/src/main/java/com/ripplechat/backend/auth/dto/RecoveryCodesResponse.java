package com.ripplechat.backend.auth.dto;

import java.util.List;

/**
 * The plaintext recovery codes, returned exactly once — when 2FA is enabled or
 * the codes are regenerated. They are never retrievable again.
 */
public record RecoveryCodesResponse(List<String> recoveryCodes) {
}
