ALTER TABLE outbox_tasks ADD COLUMN next_attempt_at timestamp(6) with time zone;
CREATE INDEX idx_outbox_tasks_next_attempt ON outbox_tasks (status, next_attempt_at);
