// Integration tests: the real Worker runs in workerd (via Miniflare) against a
// real local D1 database. Each test gets a fresh in-memory database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const ORIGIN = 'http://localhost';
const WORKER_PATH = fileURLToPath(new URL('../src/worker.js', import.meta.url));
const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);
const SESSION_COOKIE_PATTERN = /^rq_session=[0-9a-f]{64}$/;
const DAY = 24 * 60 * 60;

async function withApp(run) {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    scriptPath: WORKER_PATH,
    compatibilityDate: '2026-10-25',
    d1Databases: ['DB'],
    bindings: { APP_REVISION: 'test-revision' },
  }));
  try {
    const db = await mf.getD1Database('DB');
    await applyMigrations(db);
    await run({ mf, db, newBrowser: () => new Browser(mf) });
  } finally {
    await mf.dispose();
  }
}

// Applies migrations/*.sql in order, one statement at a time.
async function applyMigrations(db) {
  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8');
    const statements = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
    await db.batch(statements.map((statement) => db.prepare(statement)));
  }
}

// A tiny cookie jar: one Browser is one visitor.
class Browser {
  constructor(mf) {
    this.mf = mf;
    this.cookie = null;
  }

  async request(method, path, { body, origin = ORIGIN, contentType = 'application/json', base = ORIGIN } = {}) {
    const headers = {};
    if (this.cookie) headers.Cookie = this.cookie;
    if (origin) headers.Origin = origin;
    if (body !== undefined && contentType) headers['Content-Type'] = contentType;
    const init = { method, headers };
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);

    const response = await this.mf.dispatchFetch(base + path, init);
    const setCookie = response.headers.get('Set-Cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const text = await response.text();
    return { status: response.status, headers: response.headers, setCookie, body: text ? JSON.parse(text) : null };
  }

  list() {
    return this.request('GET', '/api/items', { origin: null });
  }

  add(title, url) {
    return this.request('POST', '/api/items', { body: { title, url } });
  }

  setRead(id, read) {
    return this.request('PATCH', `/api/items/${id}`, { body: { read } });
  }

  remove(id) {
    return this.request('DELETE', `/api/items/${id}`);
  }
}

async function countRows(db) {
  const row = await db.prepare('SELECT COUNT(*) AS total FROM items').first();
  return row.total;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

// Inserts `count` rows for unrelated sessions directly in SQL.
async function seedOtherSessions(db, count, createdAt, expiresAt) {
  await db
    .prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?1)
       INSERT INTO items (id, session_id, title, url, read, created_at, expires_at)
       SELECT printf('%08d-0000-4000-8000-000000000000', i), printf('%064d', i),
              'Seed', 'https://example.com/', 0, ?2, ?3
       FROM n`,
    )
    .bind(count, createdAt, expiresAt)
    .run();
}

test('health reports ok and the configured revision', async () => {
  await withApp(async ({ newBrowser }) => {
    const response = await newBrowser().request('GET', '/api/health', { origin: null });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true, revision: 'test-revision' });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  });
});

test('first GET sets a strict session cookie without writing to the database', async () => {
  await withApp(async ({ db, newBrowser }) => {
    const browser = newBrowser();
    const first = await browser.list();
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, { items: [], limit: 20 });
    assert.match(browser.cookie, SESSION_COOKIE_PATTERN);

    const attributes = first.setCookie.split(';').map((part) => part.trim());
    assert.ok(attributes.includes('HttpOnly'));
    assert.ok(attributes.includes('SameSite=Strict'));
    assert.ok(attributes.includes('Path=/'));
    assert.ok(attributes.includes('Max-Age=86400'));
    assert.ok(!attributes.includes('Secure'), 'no Secure flag over plain http');
    assert.ok(!attributes.some((part) => part.toLowerCase().startsWith('domain=')));
    assert.equal(await countRows(db), 0);

    const second = await browser.list();
    assert.equal(second.setCookie, null, 'existing session is reused');

    const https = await newBrowser().request('GET', '/api/items', { origin: null, base: 'https://localhost' });
    assert.ok(https.setCookie.split(';').map((part) => part.trim()).includes('Secure'));
  });
});

test('add, list, mark read/unread and delete within one browser', async () => {
  await withApp(async ({ newBrowser }) => {
    const browser = newBrowser();
    const added = await browser.add('  Workers docs  ', 'https://developers.cloudflare.com/workers/');
    assert.equal(added.status, 201);
    const { item } = added.body;
    assert.match(item.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(item.title, 'Workers docs');
    assert.equal(item.read, false);
    assert.equal(item.expiresAt - item.createdAt, DAY);

    const markedRead = await browser.setRead(item.id, true);
    assert.equal(markedRead.status, 200);
    assert.equal(markedRead.body.item.read, true);
    assert.equal((await browser.list()).body.items[0].read, true);

    const markedUnread = await browser.setRead(item.id, false);
    assert.equal(markedUnread.body.item.read, false);
    assert.equal((await browser.list()).body.items[0].read, false);

    assert.equal((await browser.remove(item.id)).status, 204);
    assert.deepEqual((await browser.list()).body.items, []);
    assert.equal((await browser.remove(item.id)).status, 404);
  });
});

test('browsers with different cookies cannot see or change each other’s links', async () => {
  await withApp(async ({ newBrowser }) => {
    const alice = newBrowser();
    const bob = newBrowser();
    const { item } = (await alice.add('Alice link', 'https://example.com/a')).body;
    await bob.add('Bob link', 'https://example.com/b');
    assert.notEqual(alice.cookie, bob.cookie);

    assert.deepEqual((await alice.list()).body.items.map((i) => i.title), ['Alice link']);
    assert.deepEqual((await bob.list()).body.items.map((i) => i.title), ['Bob link']);

    assert.equal((await bob.setRead(item.id, true)).status, 404);
    assert.equal((await bob.remove(item.id)).status, 404);
    const aliceItems = (await alice.list()).body.items;
    assert.equal(aliceItems.length, 1);
    assert.equal(aliceItems[0].read, false);
  });
});

test('added links persist in D1 and are returned newest first on reread', async () => {
  await withApp(async ({ db, newBrowser }) => {
    const browser = newBrowser();
    await browser.add('First', 'https://example.com/1');
    await browser.add('Second', 'HTTPS://Example.com/2');

    const rows = (await db.prepare('SELECT title, url, session_id FROM items ORDER BY rowid').all()).results;
    assert.deepEqual(rows.map((row) => row.title), ['First', 'Second']);
    assert.equal(rows[1].url, 'https://example.com/2', 'URL is stored normalised');
    assert.equal(`rq_session=${rows[0].session_id}`, browser.cookie);

    const reread = await browser.list();
    assert.deepEqual(reread.body.items.map((i) => i.title), ['Second', 'First']);
  });
});

test('rejects invalid links, titles and read values', async () => {
  await withApp(async ({ db, newBrowser }) => {
    const browser = newBrowser();
    const badUrls = [
      'javascript:alert(1)',
      'ftp://example.com/file',
      'data:text/html,hi',
      'example.com/no-scheme',
      'https://user:secret@example.com/',
      'https://user@example.com/',
      `https://example.com/${'a'.repeat(2048)}`,
      '',
    ];
    for (const url of badUrls) {
      const response = await browser.add('Title', url);
      assert.equal(response.status, 400, url);
      assert.equal(response.body.error.field, 'url', url);
    }

    for (const title of ['', '   ', 'a'.repeat(301), 'é'.repeat(151), 'bad\u0000title', 42]) {
      const response = await browser.add(title, 'https://example.com/');
      assert.equal(response.status, 400, String(title));
      assert.equal(response.body.error.field, 'title');
    }
    assert.equal((await browser.add('a'.repeat(300), 'https://example.com/')).status, 201);

    const { item } = (await browser.add('Ok', 'https://example.com/ok')).body;
    for (const read of ['true', 1, null]) {
      const response = await browser.setRead(item.id, read);
      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, 'invalid_read');
    }
    const missingRead = await browser.request('PATCH', `/api/items/${item.id}`, { body: {} });
    assert.equal(missingRead.status, 400);

    assert.equal((await browser.setRead('not-a-uuid', true)).status, 404);
    assert.equal(await countRows(db), 2);
  });
});

test('requires a JSON content type and a JSON object body', async () => {
  await withApp(async ({ newBrowser }) => {
    const browser = newBrowser();
    const body = { title: 'T', url: 'https://example.com/' };

    const textPlain = await browser.request('POST', '/api/items', { body, contentType: 'text/plain' });
    assert.equal(textPlain.status, 415);
    const form = await browser.request('POST', '/api/items', {
      body: 'title=T',
      contentType: 'application/x-www-form-urlencoded',
    });
    assert.equal(form.status, 415);
    const missing = await browser.request('POST', '/api/items', { body, contentType: null });
    assert.equal(missing.status, 415);

    const withCharset = await browser.request('POST', '/api/items', {
      body,
      contentType: 'application/json; charset=utf-8',
    });
    assert.equal(withCharset.status, 201);

    assert.equal((await browser.request('POST', '/api/items', { body: '{not json' })).status, 400);
    assert.equal((await browser.request('POST', '/api/items', { body: '[]' })).status, 400);
    assert.equal((await browser.request('POST', '/api/items', { body: 'null' })).status, 400);

    const { item } = withCharset.body;
    const patchText = await browser.request('PATCH', `/api/items/${item.id}`, {
      body: { read: true },
      contentType: 'text/plain',
    });
    assert.equal(patchText.status, 415);
  });
});

test('refuses bodies over 8 KiB, with or without Content-Length', async () => {
  await withApp(async ({ mf, db, newBrowser }) => {
    const browser = newBrowser();
    await browser.list();

    const big = JSON.stringify({ title: 'x'.repeat(9000), url: 'https://example.com/' });
    const declared = await browser.request('POST', '/api/items', { body: big });
    assert.equal(declared.status, 413);

    // A streamed body is sent chunked, so there is no Content-Length header.
    const streamOf = (chunks) =>
      new ReadableStream({
        pull(controller) {
          const next = chunks.shift();
          if (next === undefined) controller.close();
          else controller.enqueue(new TextEncoder().encode(next));
        },
      });
    const streamedHeaders = { Origin: ORIGIN, Cookie: browser.cookie, 'Content-Type': 'application/json' };

    const tooBig = await mf.dispatchFetch(`${ORIGIN}/api/items`, {
      method: 'POST',
      headers: streamedHeaders,
      body: streamOf(Array.from({ length: 12 }, () => 'x'.repeat(1024))),
      duplex: 'half',
    });
    assert.equal(tooBig.status, 413);
    await tooBig.text();

    const small = await mf.dispatchFetch(`${ORIGIN}/api/items`, {
      method: 'POST',
      headers: streamedHeaders,
      body: streamOf(['{"title":"Streamed",', '"url":"https://example.com/s"}']),
      duplex: 'half',
    });
    assert.equal(small.status, 201);
    await small.text();

    assert.equal(await countRows(db), 1);
  });
});

test('unsafe methods require an Origin header matching this site', async () => {
  await withApp(async ({ db, newBrowser }) => {
    const browser = newBrowser();
    const { item } = (await browser.add('Mine', 'https://example.com/')).body;

    for (const origin of [null, 'https://evil.example', 'null', 'http://localhost:9999']) {
      const post = await browser.request('POST', '/api/items', {
        origin,
        body: { title: 'X', url: 'https://example.com/x' },
      });
      assert.equal(post.status, 403, `POST with origin ${origin}`);
      const patch = await browser.request('PATCH', `/api/items/${item.id}`, { origin, body: { read: true } });
      assert.equal(patch.status, 403, `PATCH with origin ${origin}`);
      const del = await browser.request('DELETE', `/api/items/${item.id}`, { origin });
      assert.equal(del.status, 403, `DELETE with origin ${origin}`);
    }

    assert.equal(await countRows(db), 1);
    assert.equal((await browser.list()).body.items[0].read, false);
  });
});

test('each browser can hold at most 20 links', async () => {
  await withApp(async ({ db, newBrowser }) => {
    const browser = newBrowser();
    for (let i = 1; i <= 20; i++) {
      assert.equal((await browser.add(`Link ${i}`, `https://example.com/${i}`)).status, 201);
    }
    const over = await browser.add('Link 21', 'https://example.com/21');
    assert.equal(over.status, 409);
    assert.equal(over.body.error.code, 'session_full');
    assert.equal((await browser.list()).body.items.length, 20);

    assert.equal((await newBrowser().add('Other', 'https://example.com/other')).status, 201);
    assert.equal(await countRows(db), 21);
  });
});

test('simultaneous adds cannot exceed the per-browser cap', async () => {
  await withApp(async ({ newBrowser }) => {
    const browser = newBrowser();
    for (let i = 1; i <= 18; i++) await browser.add(`Link ${i}`, `https://example.com/${i}`);

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => browser.add(`Race ${i}`, `https://example.com/race/${i}`)),
    );
    const statuses = results.map((result) => result.status).sort();
    assert.deepEqual(statuses, [201, 201, 409, 409, 409, 409]);
    assert.equal((await browser.list()).body.items.length, 20);
  });
});

test('the demo-wide cap of 2000 live links is enforced by the insert', async () => {
  await withApp(async ({ db, newBrowser }) => {
    const now = nowSeconds();
    await seedOtherSessions(db, 2000, now, now + DAY);

    const full = await newBrowser().add('One too many', 'https://example.com/');
    assert.equal(full.status, 409);
    assert.equal(full.body.error.code, 'demo_full');
    assert.equal(await countRows(db), 2000);

    // Expired rows do not count, and adding cleans them up.
    await db.prepare('UPDATE items SET created_at = ?1, expires_at = ?2').bind(now - 2 * DAY, now - DAY).run();
    const fits = await newBrowser().add('Now it fits', 'https://example.com/');
    assert.equal(fits.status, 201);
    assert.equal(await countRows(db), 1);
  });
});

test('expired links are hidden and cannot be changed', async () => {
  await withApp(async ({ db, newBrowser }) => {
    const browser = newBrowser();
    const { item } = (await browser.add('Old', 'https://example.com/old')).body;
    const now = nowSeconds();
    await db
      .prepare('UPDATE items SET created_at = ?1, expires_at = ?2 WHERE id = ?3')
      .bind(now - DAY - 10, now - 10, item.id)
      .run();

    assert.deepEqual((await browser.list()).body.items, []);
    assert.equal((await browser.setRead(item.id, true)).status, 404);
    assert.equal((await browser.remove(item.id)).status, 404);
    assert.equal(await countRows(db), 1, 'reads do not delete');

    await browser.add('New', 'https://example.com/new');
    const titles = (await db.prepare('SELECT title FROM items').all()).results.map((row) => row.title);
    assert.deepEqual(titles, ['New'], 'adding removes expired rows');
  });
});

test('the scheduled handler deletes only expired links', async () => {
  await withApp(async ({ mf, db, newBrowser }) => {
    const browser = newBrowser();
    await browser.add('Live', 'https://example.com/live');
    const now = nowSeconds();
    await seedOtherSessions(db, 5, now - 2 * DAY, now - DAY);
    assert.equal(await countRows(db), 6);

    const worker = await mf.getWorker();
    await worker.scheduled({ cron: '17 3 * * *' });

    const titles = (await db.prepare('SELECT title FROM items').all()).results.map((row) => row.title);
    assert.deepEqual(titles, ['Live']);
  });
});

test('database constraints reject rows the Worker would never write', async () => {
  await withApp(async ({ db }) => {
    const now = nowSeconds();
    const insert = (url, read, expiresAt) =>
      db
        .prepare(
          `INSERT INTO items (id, session_id, title, url, read, created_at, expires_at)
           VALUES ('00000000-0000-4000-8000-000000000001', ?1, 'T', ?2, ?3, ?4, ?5)`,
        )
        .bind('a'.repeat(64), url, read, now, expiresAt)
        .run();

    await assert.rejects(insert('javascript:alert(1)', 0, now + DAY));
    await assert.rejects(insert('https://example.com/', 2, now + DAY));
    await assert.rejects(insert('https://example.com/', 0, now));
    await insert('https://example.com/', 0, now + DAY);
    assert.equal(await countRows(db), 1);
  });
});

test('unknown routes return 404 and wrong methods return 405', async () => {
  await withApp(async ({ newBrowser }) => {
    const browser = newBrowser();
    const missing = await browser.request('GET', '/api/nope', { origin: null });
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('Cache-Control'), 'no-store');

    const put = await browser.request('PUT', '/api/items', { body: {} });
    assert.equal(put.status, 405);
    assert.equal(put.headers.get('Allow'), 'GET, POST');
  });
});
