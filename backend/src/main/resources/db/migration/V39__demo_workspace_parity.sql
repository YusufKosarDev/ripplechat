-- Brings the already-seeded demo workspace in line with the current seed code,
-- and therefore with docs/screenshots/channel.png.
--
-- V38 translated the workspace to English, but it only performs UPDATEs. Two
-- differences from DemoSeedService survive on a database seeded before that
-- change: the JS code block sits in #engineering rather than #general, and the
-- "It is realtime" message does not exist at all because it was added to the
-- seed, not renamed.
--
-- As with V38: every statement is guarded on the current value and scoped to
-- the demo user's own rows, so this is a no-op on a freshly seeded database and
-- idempotent on re-run. A visitor's messages are never touched.

-- 1. Move the code block to #general -----------------------------------------
-- It keeps its created_at, which is later than every #general row (the seed
-- writes #general first), so it naturally sorts last — no timestamp surgery.
update messages m
set channel_id = general.id
from channels general, channels engineering, users u
where general.created_by = u.id
  and engineering.created_by = u.id
  and u.username = 'demo'
  and general.name = 'general'
  and engineering.name = 'engineering'
  and m.channel_id = engineering.id
  and m.content like '```js%greet(name)%';

-- 2. Add the message that only exists in the seed code ------------------------
-- created_at lands midway between its two neighbours so the feed order matches
-- the seed exactly. expires_at stays NULL on purpose: the seed channels carry a
-- 24h disappearing-message timer, and a stamped expiry would have the sweep
-- delete this within a day.
insert into messages (id, content, channel_id, sender_id, created_at, deleted, forwarded, pinned)
select
    gen_random_uuid(),
    'It is realtime — messages land the moment you hit send ⚡',
    general.id,
    kerem.id,
    prev.created_at + (next.created_at - prev.created_at) / 2,
    false, false, false
from channels general
    join users u on u.id = general.created_by and u.username = 'demo'
    join users kerem on kerem.username = 'kerem'
    join messages prev on prev.channel_id = general.id
        and prev.content = 'Hey! We just moved the team over here 👋'
    join messages next on next.channel_id = general.id
        and next.content = 'React with an emoji, or open a thread on any message 🧵'
where general.name = 'general'
  and not exists (
      select 1 from messages existing
      where existing.channel_id = general.id
        and existing.content like 'It is realtime%'
  );

-- 3. Match the fixture's attribution ------------------------------------------
update messages m
set sender_id = elif.id
from channels general, users u, users elif
where general.created_by = u.id
  and u.username = 'demo'
  and general.name = 'general'
  and elif.username = 'elif'
  and m.channel_id = general.id
  and m.content like 'Markdown works too:%'
  and m.sender_id <> elif.id;

-- 4. Put the markdown example back in its seeded position ---------------------
-- The old seed wrote it third; the current one writes it after the thread
-- example and immediately before the code block, which is the pairing the
-- screenshot shows. Move it into that gap rather than renumbering everything.
update messages m
set created_at = thread.created_at + (code.created_at - thread.created_at) / 2
from channels general, users u, messages thread, messages code
where general.created_by = u.id
  and u.username = 'demo'
  and general.name = 'general'
  and thread.channel_id = general.id
  and thread.content = 'React with an emoji, or open a thread on any message 🧵'
  and code.channel_id = general.id
  and code.content like '```js%greet(name)%'
  and m.channel_id = general.id
  and m.content like 'Markdown works too:%'
  and m.created_at < thread.created_at;

-- 5. Drop soft-deleted leftovers from the seed channels -----------------------
-- A visitor message that was deleted or expired leaves a soft-deleted row, which
-- the UI renders as a "This message was deleted" placeholder. Harmless in a real
-- workspace; in a demo it is the first thing a visitor sees. Only rows that are
-- already deleted and already empty are removed, so no content is destroyed.
delete from messages m
using channels c, users u
where c.created_by = u.id
  and u.username = 'demo'
  and c.name in ('general', 'engineering', 'design')
  and m.channel_id = c.id
  and m.deleted = true
  and coalesce(m.content, '') = ''
  and not exists (select 1 from messages child where child.parent_message_id = m.id);
