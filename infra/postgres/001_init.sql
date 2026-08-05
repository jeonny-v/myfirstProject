CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE,
  display_name varchar(80) NOT NULL,
  status varchar(32) NOT NULL CHECK (status IN ('ACTIVE', 'TEMP_LOCKED', 'DISABLED')),
  role varchar(32) NOT NULL CHECK (role IN ('MEMBER', 'ADMIN')),
  membership_tier varchar(32) NOT NULL CHECK (membership_tier IN ('BASIC', 'PREMIUM')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_digest char(64) NOT NULL UNIQUE,
  user_agent varchar(300) NOT NULL DEFAULT '',
  ip_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS sessions_active_user_idx
  ON sessions (user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_attempts (
  id uuid PRIMARY KEY,
  email_lookup_hash char(64) NOT NULL,
  ip_hash char(64) NOT NULL,
  success boolean NOT NULL,
  reason_code varchar(64) NOT NULL,
  request_id varchar(100) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_email_time_idx
  ON auth_attempts (email_lookup_hash, occurred_at DESC);
CREATE INDEX IF NOT EXISTS auth_attempts_ip_time_idx
  ON auth_attempts (ip_hash, occurred_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  event_type varchar(64) NOT NULL,
  result varchar(32) NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  request_id varchar(100) NOT NULL,
  ip_hash char(64) NOT NULL,
  metadata_safe jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_user_time_idx
  ON audit_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_type_time_idx
  ON audit_events (event_type, occurred_at DESC);

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO login_app;
GRANT SELECT, INSERT, UPDATE ON users, credentials, sessions, auth_attempts TO login_app;
GRANT SELECT, INSERT ON audit_events TO login_app;
