-- Activity-feed notifications: a mention, a reply to your message, or a reaction
-- to it. channel_id/message_id are denormalised so the client can jump to the
-- message without extra joins.
create table notifications (
    id           uuid not null,
    recipient_id uuid not null,
    actor_id     uuid not null,
    type         varchar(20) not null,
    channel_id   uuid not null,
    message_id   uuid not null,
    preview      varchar(200),
    is_read      boolean not null default false,
    created_at   timestamp(6) with time zone not null,
    constraint pk_notifications primary key (id),
    constraint fk_notification_recipient foreign key (recipient_id) references users (id),
    constraint fk_notification_actor foreign key (actor_id) references users (id)
);
-- The feed and the unread badge both query by recipient, newest first.
create index idx_notifications_recipient on notifications (recipient_id, created_at desc);
