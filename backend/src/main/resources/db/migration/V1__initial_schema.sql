-- Initial RippleChat schema. Mirrors the JPA entities (including the indexes
-- added for the message feed and membership lookups). Applied by Flyway in the
-- prod profile, where Hibernate runs with ddl-auto=validate. Dev does not use
-- Flyway (it relies on ddl-auto=update), so this file is prod-only.

create table users (
    id            uuid not null,
    username      varchar(255) not null,
    email         varchar(255) not null,
    display_name  varchar(255),
    avatar_color  varchar(255),
    password      varchar(255) not null,
    created_at    timestamp(6) with time zone not null,
    constraint pk_users primary key (id),
    constraint uk_users_username unique (username),
    constraint uk_users_email unique (email)
);

create table channels (
    id           uuid not null,
    name         varchar(255) not null,
    description  varchar(255),
    is_private   boolean not null,
    created_by   uuid not null,
    created_at   timestamp(6) with time zone not null,
    deleted      boolean not null default false,
    constraint pk_channels primary key (id),
    constraint fk_channels_created_by foreign key (created_by) references users (id)
);

create table channel_memberships (
    id          uuid not null,
    channel_id  uuid not null,
    user_id     uuid not null,
    role        varchar(255) not null,
    joined_at   timestamp(6) with time zone not null,
    constraint pk_channel_memberships primary key (id),
    constraint uk_membership_channel_user unique (channel_id, user_id),
    constraint fk_membership_channel foreign key (channel_id) references channels (id),
    constraint fk_membership_user foreign key (user_id) references users (id)
);
-- user_id-leading lookups (findByUser_Username — channel list + search).
create index idx_membership_user on channel_memberships (user_id);

create table messages (
    id                 uuid not null,
    content            text not null,
    channel_id         uuid not null,
    sender_id          uuid not null,
    parent_message_id  uuid,
    created_at         timestamp(6) with time zone not null,
    edited_at          timestamp(6) with time zone,
    deleted            boolean not null default false,
    constraint pk_messages primary key (id),
    constraint fk_messages_channel foreign key (channel_id) references channels (id),
    constraint fk_messages_sender foreign key (sender_id) references users (id),
    constraint fk_messages_parent foreign key (parent_message_id) references messages (id)
);
-- Main channel feed: channel_id = ? and parent_message_id is null order by created_at.
create index idx_messages_channel_parent_created on messages (channel_id, parent_message_id, created_at);
-- Thread replies: parent_message_id = ?/in (?) order by created_at.
create index idx_messages_parent_created on messages (parent_message_id, created_at);

create table message_reactions (
    id          uuid not null,
    message_id  uuid not null,
    user_id     uuid not null,
    emoji       varchar(255) not null,
    created_at  timestamp(6) with time zone not null,
    constraint pk_message_reactions primary key (id),
    constraint uk_reaction_message_user_emoji unique (message_id, user_id, emoji),
    constraint fk_reaction_message foreign key (message_id) references messages (id),
    constraint fk_reaction_user foreign key (user_id) references users (id)
);
