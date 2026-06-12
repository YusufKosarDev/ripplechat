-- Polls, their options and votes. Replaces the previous in-memory poll store so
-- polls and votes survive restarts. Prod-only (dev relies on ddl-auto=update);
-- applied by Flyway with Hibernate ddl-auto=validate.

create table polls (
    id          uuid not null,
    channel_id  uuid not null,
    question    varchar(300) not null,
    created_by  varchar(255) not null,
    created_at  timestamp(6) with time zone not null,
    constraint pk_polls primary key (id),
    constraint fk_polls_channel foreign key (channel_id) references channels (id)
);
-- Per-channel listing ordered by recency.
create index idx_polls_channel_created on polls (channel_id, created_at);

create table poll_options (
    id          uuid not null,
    poll_id     uuid not null,
    option_key  varchar(255) not null,
    text        varchar(100) not null,
    position    integer not null,
    constraint pk_poll_options primary key (id),
    constraint fk_poll_options_poll foreign key (poll_id) references polls (id)
);
create index idx_poll_options_poll on poll_options (poll_id);

create table poll_votes (
    id          uuid not null,
    poll_id     uuid not null,
    username    varchar(255) not null,
    option_key  varchar(255) not null,
    constraint pk_poll_votes primary key (id),
    -- One (changeable) vote per user per poll.
    constraint uk_poll_vote_user unique (poll_id, username),
    constraint fk_poll_votes_poll foreign key (poll_id) references polls (id)
);
