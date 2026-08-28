-- A scheduled message that cannot be delivered — its author left the channel,
-- the channel was archived — used to be retried by the dispatcher every 30
-- seconds forever, logging a stack trace each time and never leaving the queue.
--
-- Track the attempts so delivery can give up, and keep the reason so the row
-- explains itself rather than only living in the logs.
ALTER TABLE scheduled_messages ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scheduled_messages ADD COLUMN IF NOT EXISTS last_error TEXT;
