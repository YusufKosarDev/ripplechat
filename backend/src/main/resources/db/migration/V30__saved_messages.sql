-- Per-user message bookmarks. Stored as plain ids (like message_hides); the
-- message row is untouched. Unique per (message, user); listed newest-saved-first.
create table saved_messages (
    id         uuid not null,
    message_id uuid not null,
    user_id    uuid not null,
    saved_at   timestamp(6) with time zone not null,
    constraint pk_saved_messages primary key (id),
    constraint uk_saved_message_user unique (message_id, user_id)
);
create index idx_saved_messages_user on saved_messages (user_id, saved_at desc);
