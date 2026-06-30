-- Out-of-band account-action tokens (email verification, password reset). Like
-- refresh_tokens, only the SHA-256 hash of the opaque token is stored, so a
-- database leak does not expose usable links. Single-use (used flag) and expiring.
create table auth_tokens (
    id          uuid not null,
    token_hash  varchar(255) not null,
    user_id     uuid not null,
    type        varchar(40) not null,
    expires_at  timestamp(6) with time zone not null,
    used        boolean not null default false,
    created_at  timestamp(6) with time zone not null,
    constraint pk_auth_tokens primary key (id),
    constraint uk_auth_token_hash unique (token_hash),
    constraint fk_auth_token_user foreign key (user_id) references users (id)
);
create index idx_auth_token_user on auth_tokens (user_id);

-- Whether the user has confirmed ownership of their email address. Non-blocking:
-- unverified users can still sign in; the flag drives an in-app "verify" prompt.
alter table users add column if not exists email_verified boolean not null default false;
