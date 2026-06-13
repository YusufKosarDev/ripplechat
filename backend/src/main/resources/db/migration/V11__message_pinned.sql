-- Pinned messages: highlight important messages per channel. Prod-only (dev
-- relies on ddl-auto); applied by Flyway with validate.

alter table messages add column pinned boolean not null default false;
