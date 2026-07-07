CREATE TABLE group_sender_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id    UUID         NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    sender_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_key TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  DEFAULT now(),
    UNIQUE(channel_id, sender_id, recipient_id)
);

CREATE INDEX idx_group_sender_keys_lookup ON group_sender_keys(channel_id, recipient_id);
