-- Uploaded avatar image URL (Cloudinary). Nullable: users without an uploaded
-- photo fall back to the colored initial. Prod-only (dev relies on ddl-auto);
-- applied by Flyway with Hibernate ddl-auto=validate.

alter table users add column avatar_url varchar(1024);
