-- Browser Web Push (VAPID) subscriptions, one row per device/endpoint.
-- Prod-only (dev relies on ddl-auto); applied by Flyway with validate.

create table push_subscriptions (
    id          uuid not null,
    user_id     uuid not null,
    endpoint    varchar(1024) not null,
    p256dh      varchar(255) not null,
    auth        varchar(255) not null,
    created_at  timestamp(6) with time zone not null,
    constraint pk_push_subscriptions primary key (id),
    constraint uk_push_endpoint unique (endpoint),
    constraint fk_push_subscriptions_user foreign key (user_id) references users (id)
);
create index idx_push_subscriptions_user on push_subscriptions (user_id);
