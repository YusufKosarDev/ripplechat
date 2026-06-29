-- Messages a user has scheduled to be delivered to a channel at a future time.
-- A background worker (ScheduledMessageDispatcher) sends due, unsent rows through
-- the normal message pipeline and marks them sent.
create table scheduled_messages (
    id           uuid not null,
    channel_id   uuid not null,
    sender_id    uuid not null,
    content      text not null,
    scheduled_at timestamp(6) with time zone not null,
    created_at   timestamp(6) with time zone not null,
    sent         boolean not null default false,
    constraint pk_scheduled_messages primary key (id),
    constraint fk_scheduled_messages_channel foreign key (channel_id) references channels (id),
    constraint fk_scheduled_messages_sender foreign key (sender_id) references users (id)
);

-- Hot path for the dispatcher: pending rows, ordered by when they come due.
create index idx_scheduled_messages_due on scheduled_messages (scheduled_at) where sent = false;
