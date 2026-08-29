-- Deleting a message now scrubs the denormalised quote snapshots that copied
-- its text, which means looking up "every message quoting this one". Without an
-- index that is a sequential scan of the whole table on every delete and on
-- every tick of the disappearing-message sweep.
--
-- Partial: the column is null for the vast majority of rows (only quoted
-- replies set it), so the index stays small.
CREATE INDEX IF NOT EXISTS idx_messages_quoted_message_id
    ON messages (quoted_message_id)
    WHERE quoted_message_id IS NOT NULL;
