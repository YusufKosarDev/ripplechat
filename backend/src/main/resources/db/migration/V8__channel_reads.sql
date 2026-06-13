-- Per-user read position in a channel/DM, powering read receipts. One row per
-- (channel, user); messages at or before last_read_at are read by that user.
-- Prod-only (dev relies on ddl-auto); applied by Flyway with validate.

create table channel_reads (
    id            uuid not null,
    channel_id    uuid not null,
    user_id       uuid not null,
    last_read_at  timestamp(6) with time zone not null,
    constraint pk_channel_reads primary key (id),
    constraint uk_channel_read_user unique (channel_id, user_id),
    constraint fk_channel_reads_channel foreign key (channel_id) references channels (id),
    constraint fk_channel_reads_user foreign key (user_id) references users (id)
);
create index idx_channel_reads_channel on channel_reads (channel_id);
