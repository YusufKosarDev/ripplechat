-- Full-text search index for message content. A functional GIN index on
-- to_tsvector('simple', content) backs the ranked search query — no schema
-- column is needed, so dev/test run the same query unindexed (just a scan),
-- while prod gets index-speed lookups. Prod-only (dev relies on ddl-auto).

create index idx_messages_content_fts on messages using gin (to_tsvector('simple', content));
