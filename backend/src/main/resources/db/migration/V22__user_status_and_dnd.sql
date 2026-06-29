-- Custom user status (emoji + text, with optional auto-expiry) and a personal
-- Do-Not-Disturb window that suppresses web-push notifications while active.
alter table users add column if not exists status_emoji varchar(16);
alter table users add column if not exists status_text varchar(100);
alter table users add column if not exists status_expires_at timestamp(6) with time zone;
alter table users add column if not exists dnd_until timestamp(6) with time zone;
