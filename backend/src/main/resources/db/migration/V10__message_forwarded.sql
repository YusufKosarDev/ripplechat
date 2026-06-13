-- Marks a message as forwarded (created by forwarding another message), so the
-- UI can show a "forwarded" label. Prod-only (dev relies on ddl-auto); applied
-- by Flyway with validate.

alter table messages add column forwarded boolean not null default false;
