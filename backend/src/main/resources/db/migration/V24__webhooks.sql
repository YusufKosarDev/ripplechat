-- Bot accounts (e.g. incoming-webhook posters) are real users so they can be a
-- message sender, but are hidden from people-search and the DM picker.
alter table users add column if not exists bot boolean not null default false;

-- Incoming webhooks: an external system POSTs to /api/hooks/{token} and the body
-- is posted to the channel as a message from the webhook's bot identity. Only the
-- SHA-256 hash of the token is stored, so a database leak does not expose usable URLs.
create table webhooks (
    id          uuid not null,
    channel_id  uuid not null,
    bot_user_id uuid not null,
    token_hash  varchar(64) not null,
    name        varchar(80) not null,
    created_by  uuid not null,
    created_at  timestamp(6) with time zone not null,
    constraint pk_webhooks primary key (id),
    constraint uk_webhooks_token_hash unique (token_hash),
    constraint fk_webhooks_channel foreign key (channel_id) references channels (id),
    constraint fk_webhooks_bot foreign key (bot_user_id) references users (id),
    constraint fk_webhooks_creator foreign key (created_by) references users (id)
);

create index idx_webhooks_channel on webhooks (channel_id);
