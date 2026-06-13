-- "Delete for me": per-user hidden messages, filtered out of that user's feed
-- without touching the message itself. Prod-only (dev relies on ddl-auto);
-- applied by Flyway with validate.

create table message_hides (
    id          uuid not null,
    message_id  uuid not null,
    user_id     uuid not null,
    constraint pk_message_hides primary key (id),
    constraint uk_message_hide_user unique (message_id, user_id),
    constraint fk_message_hides_message foreign key (message_id) references messages (id),
    constraint fk_message_hides_user foreign key (user_id) references users (id)
);
create index idx_message_hides_user on message_hides (user_id);
