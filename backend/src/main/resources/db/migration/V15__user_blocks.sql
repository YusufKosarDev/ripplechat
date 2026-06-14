-- User blocking: one row per (blocker, blocked). Blocked users can't start DMs
-- with you, and their messages are filtered out of your channel feed. Prod-only
-- (dev relies on ddl-auto); applied by Flyway with validate.

create table user_blocks (
    id          uuid not null,
    blocker_id  uuid not null,
    blocked_id  uuid not null,
    constraint pk_user_blocks primary key (id),
    constraint uk_user_block unique (blocker_id, blocked_id),
    constraint fk_user_blocks_blocker foreign key (blocker_id) references users (id),
    constraint fk_user_blocks_blocked foreign key (blocked_id) references users (id)
);
create index idx_user_blocks_blocker on user_blocks (blocker_id);
