-- Quoted replies: an inline quote of another message (distinct from threads).
-- The preview (sender + snippet) is denormalized so it renders without a join
-- and survives the quoted message being edited/deleted. Prod-only (dev uses
-- ddl-auto); applied by Flyway with validate.

alter table messages add column quoted_message_id uuid;
alter table messages add column quoted_sender varchar(255);
alter table messages add column quoted_content text;
