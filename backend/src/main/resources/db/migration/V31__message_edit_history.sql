-- Prior versions of an edited message. Each row is a snapshot of the content
-- that was replaced by an edit, timestamped at the moment it stopped being current.
CREATE TABLE message_edit_history (
    id         UUID PRIMARY KEY,
    message_id UUID        NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    content    TEXT        NOT NULL,
    edited_at  TIMESTAMPTZ NOT NULL
);

-- History lookup for one message, newest first.
CREATE INDEX idx_message_edit_history_message ON message_edit_history (message_id, edited_at DESC);
