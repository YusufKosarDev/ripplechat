-- Direct messages. A DM is a private channel of type DIRECT with two members,
-- reusing the existing message/reaction/thread/WebSocket machinery. The dm_key
-- ("minUserId:maxUserId") keeps a user pair to a single conversation. Prod-only
-- (dev relies on ddl-auto); applied by Flyway with Hibernate ddl-auto=validate.

alter table channels add column type varchar(20) not null default 'CHANNEL';
alter table channels add column dm_key varchar(255);
alter table channels add constraint uk_channels_dm_key unique (dm_key);
