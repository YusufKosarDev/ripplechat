-- Image attachments on messages. The URL points at Cloudinary (uploads go
-- through POST /api/uploads/image). Nullable: a message can be text, an image,
-- or both. Prod-only (dev relies on ddl-auto); applied by Flyway with validate.

alter table messages add column attachment_url varchar(1024);
