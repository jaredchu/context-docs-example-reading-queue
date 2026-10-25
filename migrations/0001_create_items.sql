-- Reading Queue items. Every row belongs to one browser session and expires
-- 24 hours after creation. The Worker validates input first; these checks are
-- a second line of defence. Byte lengths use CAST(... AS BLOB).
CREATE TABLE items (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  session_id TEXT NOT NULL CHECK (length(session_id) = 64),
  title TEXT NOT NULL CHECK (length(CAST(title AS BLOB)) BETWEEN 1 AND 300),
  url TEXT NOT NULL CHECK (
    length(CAST(url AS BLOB)) BETWEEN 1 AND 2048
    AND (url LIKE 'http://%' OR url LIKE 'https://%')
  ),
  read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
);

-- Listing and per-session cap counting: WHERE session_id = ? AND expires_at > ?
CREATE INDEX items_session_expires ON items (session_id, expires_at);

-- Cleanup and global cap counting: WHERE expires_at <= ? / expires_at > ?
CREATE INDEX items_expires ON items (expires_at);
