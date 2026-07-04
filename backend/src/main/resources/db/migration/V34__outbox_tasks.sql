-- Transactional Outbox tasks for reliable asynchronous processing of external API calls.
create table if not exists outbox_tasks (
    id              uuid not null,
    task_type       varchar(64) not null,
    payload         text not null,
    status          varchar(32) not null,
    attempts        integer not null default 0,
    last_attempt_at timestamp(6) with time zone,
    created_at      timestamp(6) with time zone not null,
    error_message   text,
    constraint pk_outbox_tasks primary key (id)
);

create index if not exists idx_outbox_tasks_status_created on outbox_tasks (status, created_at);
