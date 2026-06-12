-- Refresh tokens (server-side, revocable). Added with the refresh-token auth
-- flow: short-lived access JWTs are renewed via a stored, rotating refresh
-- token. Only the SHA-256 hash of the opaque token is stored. Prod-only (dev
-- relies on ddl-auto=update); applied by Flyway with Hibernate ddl-auto=validate.

create table refresh_tokens (
    id          uuid not null,
    token_hash  varchar(255) not null,
    user_id     uuid not null,
    expires_at  timestamp(6) with time zone not null,
    created_at  timestamp(6) with time zone not null,
    constraint pk_refresh_tokens primary key (id),
    constraint uk_refresh_token_hash unique (token_hash),
    constraint fk_refresh_token_user foreign key (user_id) references users (id)
);
-- Refresh tokens are looked up by hash on every renew/revoke.
create index idx_refresh_token_user on refresh_tokens (user_id);
