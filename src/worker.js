// Reading Queue Worker: a small JSON API over D1 for a temporary,
// browser-isolated reading list. Static files in ./public are served by
// Workers static assets; only /api/* requests reach this code.
//
// API contract (every response is JSON with Cache-Control: no-store)
//
//   GET    /api/health     -> 200 { ok: true, revision }
//   GET    /api/items      -> 200 { items: [Item], limit }
//                             Sets the session cookie if absent. Never writes to D1.
//   POST   /api/items      -> 201 { item }      body: { "title": string, "url": string }
//   PATCH  /api/items/:id  -> 200 { item }      body: { "read": boolean }
//   DELETE /api/items/:id  -> 204 (no body)
//
//   Item:   { id, title, url, read, createdAt, expiresAt }  (times in unix seconds)
//   Errors: { error: { code, message, field? } } with status 400, 403, 404, 405,
//           409, 413, 415 or 500. `field` names the form input to fix, if any.
//
// Rules
// - A browser session is a random 256-bit hex ID in an HttpOnly cookie. It is
//   not an account: anyone holding the cookie can use the queue.
// - Every SELECT/UPDATE/DELETE on items is limited to the caller's session and
//   to rows that have not expired.
// - Items expire 24 hours after creation. Expired rows are ignored by reads and
//   deleted on each add and by the daily cron trigger.
// - Caps (20 per session, 2000 overall) are enforced inside the INSERT itself.
// - POST, PATCH and DELETE require an Origin header equal to this site's origin.
//   POST and PATCH require Content-Type: application/json and a body <= 8 KiB.
// - Submitted links are stored only. The Worker never fetches them.
//
// These limits keep the demo small; they are not full abuse protection. There
// is no global rate limit, so heavy traffic can still use up the shared quota.

const SESSION_COOKIE = 'rq_session';
const SESSION_PATTERN = /^[0-9a-f]{64}$/;
const ITEM_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ITEM_LIFETIME_SECONDS = 24 * 60 * 60;
const MAX_ITEMS_PER_SESSION = 20;
const MAX_ITEMS_TOTAL = 2000;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TITLE_BYTES = 300;
const MAX_URL_BYTES = 2048;

const API_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

const ITEM_COLUMNS = 'id, title, url, read, created_at, expires_at';

// Insert only if both caps still have room. The counts and the insert are one
// SQL statement, so two simultaneous requests cannot both squeeze past a cap.
const INSERT_ITEM_SQL = `
  INSERT INTO items (id, session_id, title, url, read, created_at, expires_at)
  SELECT ?1, ?2, ?3, ?4, 0, ?5, ?6
  WHERE (SELECT COUNT(*) FROM items WHERE session_id = ?2 AND expires_at > ?5) < ?7
    AND (SELECT COUNT(*) FROM items WHERE expires_at > ?5) < ?8`;

const DELETE_EXPIRED_SQL = 'DELETE FROM items WHERE expires_at <= ?1';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      // Normally unreachable: run_worker_first only routes /api/* here.
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    }

    try {
      return await handleApi(request, env, url);
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.status, error.code, error.message, error.field);
      }
      // Log only the error type and route. Never log bodies, links or cookies.
      console.error('Unhandled API error', {
        name: error?.name ?? 'Error',
        method: request.method,
        route: url.pathname.startsWith('/api/items/') ? '/api/items/:id' : url.pathname,
      });
      return errorResponse(500, 'server_error', 'Something went wrong. Please try again.');
    }
  },

  // Daily cron trigger (see wrangler.jsonc).
  async scheduled(controller, env) {
    await env.DB.prepare(DELETE_EXPIRED_SQL).bind(nowSeconds()).run();
  },
};

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;

  if (pathname === '/api/health') {
    if (method !== 'GET') return methodNotAllowed('GET');
    return json({ ok: true, revision: env.APP_REVISION || 'local' });
  }

  if (pathname === '/api/items') {
    if (method === 'GET') return listItems(request, env, url);
    if (method === 'POST') return createItem(request, env, url);
    return methodNotAllowed('GET, POST');
  }

  const match = pathname.match(/^\/api\/items\/([^/]+)$/);
  if (match) {
    if (method === 'PATCH') return updateItem(request, env, url, match[1]);
    if (method === 'DELETE') return deleteItem(request, env, url, match[1]);
    return methodNotAllowed('PATCH, DELETE');
  }

  return errorResponse(404, 'not_found', 'No such API route.');
}

// ---- Route handlers --------------------------------------------------------

async function listItems(request, env, url) {
  const session = getSession(request);
  let items = [];
  if (!session.isNew) {
    const { results } = await env.DB.prepare(
      `SELECT ${ITEM_COLUMNS} FROM items
       WHERE session_id = ?1 AND expires_at > ?2
       ORDER BY created_at DESC, rowid DESC`,
    )
      .bind(session.id, nowSeconds())
      .all();
    items = results.map(toItem);
  }

  const response = json({ items, limit: MAX_ITEMS_PER_SESSION });
  if (session.isNew) response.headers.append('Set-Cookie', sessionCookie(session.id, url));
  return response;
}

async function createItem(request, env, url) {
  requireSameOrigin(request, url);
  requireJson(request);
  const { title, url: link } = validateNewItem(await readJsonBody(request));

  const session = getSession(request);
  const createdAt = nowSeconds();
  const item = {
    id: crypto.randomUUID(),
    title,
    url: link,
    read: false,
    createdAt,
    expiresAt: createdAt + ITEM_LIFETIME_SECONDS,
  };

  // A batch runs as one transaction: clean up expired rows, then insert.
  const [, insert] = await env.DB.batch([
    env.DB.prepare(DELETE_EXPIRED_SQL).bind(createdAt),
    env.DB.prepare(INSERT_ITEM_SQL).bind(
      item.id,
      session.id,
      item.title,
      item.url,
      item.createdAt,
      item.expiresAt,
      MAX_ITEMS_PER_SESSION,
      MAX_ITEMS_TOTAL,
    ),
  ]);

  if (insert.meta.changes === 0) {
    // Nothing was inserted, so a cap was reached. Count again only to choose
    // the right message; the decision itself was made by the INSERT.
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS total FROM items WHERE session_id = ?1 AND expires_at > ?2',
    )
      .bind(session.id, createdAt)
      .first();
    if (row.total >= MAX_ITEMS_PER_SESSION) {
      throw new HttpError(
        409,
        'session_full',
        `Your queue already has ${MAX_ITEMS_PER_SESSION} links. Delete one to add another.`,
      );
    }
    throw new HttpError(409, 'demo_full', 'The demo is full right now. Please try again later.');
  }

  // Re-send the cookie so it lasts at least as long as the newest link.
  const response = json({ item }, 201);
  response.headers.append('Set-Cookie', sessionCookie(session.id, url));
  return response;
}

async function updateItem(request, env, url, id) {
  requireSameOrigin(request, url);
  requireJson(request);
  const data = await readJsonBody(request);
  if (typeof data.read !== 'boolean') {
    throw new HttpError(400, 'invalid_read', '"read" must be true or false.', 'read');
  }

  const session = getSession(request);
  if (session.isNew || !ITEM_ID_PATTERN.test(id)) throw itemNotFound();

  const row = await env.DB.prepare(
    `UPDATE items SET read = ?1
     WHERE id = ?2 AND session_id = ?3 AND expires_at > ?4
     RETURNING ${ITEM_COLUMNS}`,
  )
    .bind(data.read ? 1 : 0, id, session.id, nowSeconds())
    .first();
  if (!row) throw itemNotFound();

  return json({ item: toItem(row) });
}

async function deleteItem(request, env, url, id) {
  requireSameOrigin(request, url);

  const session = getSession(request);
  if (session.isNew || !ITEM_ID_PATTERN.test(id)) throw itemNotFound();

  const result = await env.DB.prepare(
    'DELETE FROM items WHERE id = ?1 AND session_id = ?2 AND expires_at > ?3',
  )
    .bind(id, session.id, nowSeconds())
    .run();
  if (result.meta.changes === 0) throw itemNotFound();

  return new Response(null, { status: 204, headers: API_HEADERS });
}

// ---- Sessions --------------------------------------------------------------

// Returns the caller's session ID, or a fresh random one if the cookie is
// missing or malformed. A fresh ID is not stored anywhere until an item is added.
function getSession(request) {
  const id = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  if (id && SESSION_PATTERN.test(id)) return { id, isNew: false };

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { id: hex, isNew: true };
}

function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

// No Domain attribute, so the cookie stays on this exact host.
function sessionCookie(id, url) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${id}; Max-Age=${ITEM_LIFETIME_SECONDS}; Path=/; HttpOnly; SameSite=Strict${secure}`;
}

// ---- Request checks --------------------------------------------------------

function requireSameOrigin(request, url) {
  if (request.headers.get('Origin') !== url.origin) {
    throw new HttpError(403, 'bad_origin', 'This request must come from the Reading Queue page.');
  }
}

function requireJson(request) {
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') {
    throw new HttpError(415, 'unsupported_media_type', 'Send the request body as application/json.');
  }
}

// Reads at most MAX_BODY_BYTES, even when Content-Length is missing or wrong,
// by counting bytes while streaming and stopping as soon as the limit is passed.
async function readJsonBody(request) {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) throw bodyTooLarge();
  if (!request.body) throw new HttpError(400, 'invalid_json', 'A JSON request body is required.');

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      throw bodyTooLarge();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let data;
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'invalid_json', 'The request body must be a JSON object.');
  }
  return data;
}

// Validates { url, title } and returns trimmed values with the URL normalised.
// URL is checked first because it is the first field in the form.
function validateNewItem(data) {
  const rawUrl = typeof data.url === 'string' ? data.url.trim() : '';
  if (!rawUrl) throw new HttpError(400, 'invalid_url', 'Enter a link.', 'url');
  if (byteLength(rawUrl) > MAX_URL_BYTES) throw urlTooLong();

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    parsed = null;
  }
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    throw new HttpError(400, 'invalid_url', 'Enter a full link starting with http:// or https://.', 'url');
  }
  if (parsed.username || parsed.password) {
    throw new HttpError(400, 'invalid_url', 'Links must not contain a username or password.', 'url');
  }
  if (byteLength(parsed.href) > MAX_URL_BYTES) throw urlTooLong();

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) throw new HttpError(400, 'invalid_title', 'Enter a title.', 'title');
  if (byteLength(title) > MAX_TITLE_BYTES) {
    throw new HttpError(400, 'invalid_title', `The title can be at most ${MAX_TITLE_BYTES} bytes.`, 'title');
  }
  if (/[\u0000-\u001f\u007f]/.test(title)) {
    throw new HttpError(400, 'invalid_title', 'The title must not contain control characters.', 'title');
  }

  return { url: parsed.href, title };
}

// ---- Responses and helpers -------------------------------------------------

class HttpError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...API_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(status, code, message, field) {
  return json({ error: field ? { code, message, field } : { code, message } }, status);
}

function methodNotAllowed(allow) {
  const response = errorResponse(405, 'method_not_allowed', 'Method not allowed.');
  response.headers.set('Allow', allow);
  return response;
}

function itemNotFound() {
  return new HttpError(404, 'not_found', 'That link was not found. It may have expired or been deleted.');
}

function bodyTooLarge() {
  return new HttpError(413, 'body_too_large', `The request body must be at most ${MAX_BODY_BYTES} bytes.`);
}

function urlTooLong() {
  return new HttpError(400, 'invalid_url', `The link can be at most ${MAX_URL_BYTES} bytes.`, 'url');
}

function toItem(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    read: row.read === 1,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}
