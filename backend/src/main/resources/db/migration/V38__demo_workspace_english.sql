-- Translates the seeded demo workspace to English so the hosted demo matches
-- docs/screenshots/*.png (generated from the English fixture in
-- frontend/e2e/screenshots.spec.ts).
--
-- Why a migration and not just the Java change: DemoSeedService.seedContentIfAbsent()
-- returns early when the "demo" user already exists, so translating the seed
-- literals alone would never touch a database that has already been seeded --
-- including production. Worse, DemoSeedService.resetMutableDemoState() treats
-- any channel not in SEED_CHANNELS as visitor junk, so after the rename the
-- nightly sweep would have soft-deleted the whole demo workspace. (The Java
-- side also keeps a LEGACY_SEED_CHANNELS guard, so that is safe even if this
-- migration has not run.)
--
-- Every statement is guarded on the old Turkish value, so this is a no-op on a
-- freshly seeded (already English) database and idempotent on re-run. Only the
-- demo user's own rows are touched.

-- Channels ------------------------------------------------------------------
update channels c
set name        = 'general',
    description = 'Open to everyone'
from users u
where c.created_by = u.id
  and u.username = 'demo'
  and c.name = 'genel';

update channels c
set name        = 'engineering',
    description = 'Code, tooling and releases'
from users u
where c.created_by = u.id
  and u.username = 'demo'
  and c.name = 'yazılım';

update channels c
set name        = 'design',
    description = 'UI/UX and visual design'
from users u
where c.created_by = u.id
  and u.username = 'demo'
  and c.name = 'tasarım';

-- Demo account display name --------------------------------------------------
update users
set display_name = 'Demo User'
where username = 'demo'
  and display_name = 'Demo Kullanıcı';

-- Seed messages --------------------------------------------------------------
-- Matched on their exact seeded text, so a visitor's own messages are never
-- rewritten. Wording mirrors DemoSeedService.seedContentIfAbsent().
update messages
set content = 'Welcome to RippleChat! 🎉'
where content like 'RippleChat''e hoş geldin!%';

update messages
set content = 'Hey! We just moved the team over here 👋'
where content like 'Selam! Bir mesajın üstüne gelince%';

update messages
set content = 'Markdown works too: **bold**, *italic* and `inline code` 🙂'
where content like 'Markdown desteği var:%';

update messages
set content = 'React with an emoji, or open a thread on any message 🧵'
where content like 'Bir konuyu dağıtmadan tartışmak için thread%';

update messages
set content = 'Threads keep the main channel readable 🙌'
where content = 'Thread çalışıyor! Ana akış tertemiz kalıyor 🙌';

update messages
set content = 'Exactly — ideal for the long discussions.'
where content = 'Süper, uzun tartışmalar için birebir.';

update messages
set content = 'Search runs on Elasticsearch, with a PostgreSQL fallback'
where content = 'Bugün ufak bir yardımcı yazdım:';

-- The dollar sign is assembled with chr(36) on purpose. Flyway treats a dollar
-- followed by a braced name as a placeholder to substitute, so writing the JS
-- template string literally aborts the migration with "No value provided for
-- placeholder". That applies to comments too, hence the wording here.
update messages
set content = '```js' || chr(10) ||
              'function greet(name) {' || chr(10) ||
              '  return `Hello, ' || chr(36) || '{name}!`' || chr(10) ||
              '}' || chr(10) ||
              'console.log(greet("RippleChat"))' || chr(10) ||
              '```'
where content like '```js%function selamla(ad)%';

update messages
set content = 'Code blocks come through syntax-highlighted 👏'
where content = 'Temiz görünüyor 👏 Kod blokları sözdizimi vurgulu geliyor.';

update messages
set content = 'The dark theme turned out well ✨ Toggle it from the top right.'
where content like 'Koyu tema gerçekten şık olmuş%';

update messages
set content = 'Works on mobile too — the layout is fully responsive.'
where content = 'Mobilde de düzgün çalışıyor — responsive tasarım hazır.';

-- Quoted-reply previews ------------------------------------------------------
-- MessageService persists this snapshot into messages.quoted_content, so rows
-- written before the string was translated keep the old text.
update messages
set quoted_content = '📷 Image'
where quoted_content = '📷 Görsel';

-- Demo poll ------------------------------------------------------------------
update polls
set question = 'What''s your favourite programming language?'
where question = 'Favori programlama diliniz?';
