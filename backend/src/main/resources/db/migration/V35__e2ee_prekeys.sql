-- =====================================================
-- V35: E2EE Pre-Key tables for X3DH key agreement
-- =====================================================

CREATE TABLE signed_pre_keys (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id     INT          NOT NULL,
    public_key TEXT         NOT NULL,
    signature  TEXT         NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT now(),
    UNIQUE(user_id, key_id)
);

CREATE TABLE one_time_pre_keys (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id     INT  NOT NULL,
    public_key TEXT NOT NULL,
    UNIQUE(user_id, key_id)
);

CREATE INDEX idx_signed_pre_keys_user ON signed_pre_keys(user_id);
CREATE INDEX idx_one_time_pre_keys_user ON one_time_pre_keys(user_id);
