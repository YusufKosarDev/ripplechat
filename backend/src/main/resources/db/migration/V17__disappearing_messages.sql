-- Disappearing messages: a per-channel timer (seconds; null/0 = off) stamps each
-- new message with an expiry. A scheduled job soft-deletes messages past their
-- expires_at. Prod-only (dev relies on ddl-auto); applied by Flyway with validate.

alter table channels add column message_ttl_seconds integer;
alter table messages add column expires_at timestamptz;

create index idx_messages_expires_at on messages (expires_at) where expires_at is not null;
