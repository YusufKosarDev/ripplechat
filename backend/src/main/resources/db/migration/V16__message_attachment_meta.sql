-- Attachment metadata: original filename and kind ("image" or "file"), so
-- non-image attachments render as a download card. Prod-only (dev relies on
-- ddl-auto); applied by Flyway with validate.

alter table messages add column attachment_name varchar(255);
alter table messages add column attachment_type varchar(16);
