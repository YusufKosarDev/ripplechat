-- Last-seen timestamp, updated when a user's last WebSocket connection closes.
-- Prod-only (dev relies on ddl-auto); applied by Flyway with validate.

alter table users add column last_seen_at timestamp(6) with time zone;
