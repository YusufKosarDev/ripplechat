-- ShedLock backing table: holds one row per named scheduled task and acts as a
-- distributed lock so that, across multiple backend replicas, only one instance
-- runs a given @Scheduled task per tick (the disappearing-message sweep and the
-- scheduled-message dispatcher). Schema is ShedLock's standard JDBC layout.
create table if not exists shedlock (
    name       varchar(64)  not null,
    lock_until timestamp    not null,
    locked_at  timestamp    not null,
    locked_by  varchar(255) not null,
    constraint pk_shedlock primary key (name)
);
