-- Local contract schema. D1 is a derived Edge/app index; TCP/MySQL remains
-- authoritative and may only publish validated projections through an outbox.
CREATE TABLE IF NOT EXISTS tag_routing (
  tag_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'deactivated', 'expired')),
  target_type TEXT NOT NULL CHECK (target_type IN ('internal', 'external')),
  external_url TEXT NULL,
  protection_mode TEXT NOT NULL CHECK (protection_mode IN ('public', 'pin_required', 'login_required', 'closed')),
  access_version INTEGER NOT NULL CHECK (access_version >= 1),
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  schema_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS tag_routing_active_lookup_idx
  ON tag_routing (tag_id, status);

CREATE TABLE IF NOT EXISTS tag_pin_credentials (
  tag_id TEXT PRIMARY KEY REFERENCES tag_routing(tag_id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  pin_version INTEGER NOT NULL CHECK (pin_version >= 1),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tag_access_sessions (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_routing(tag_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  access_version INTEGER NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('public', 'pin', 'login')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS tag_access_sessions_lookup_idx
  ON tag_access_sessions (tag_id, token_hash, expires_at);

CREATE TABLE IF NOT EXISTS tag_pin_throttles (
  tag_id TEXT NOT NULL,
  client_key TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tag_id, client_key)
);