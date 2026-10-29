CREATE SCHEMA IF NOT EXISTS tp5_push;

CREATE TABLE IF NOT EXISTS tp5_push.schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tp5_push.subscriptions (
  namespace text NOT NULL,
  id text NOT NULL CHECK (id ~ '^[a-f0-9]{32}$'),
  endpoint_hash text NOT NULL CHECK (endpoint_hash ~ '^[a-f0-9]{64}$'),
  version bigint NOT NULL CHECK (version > 0),
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (namespace, id),
  UNIQUE (namespace, endpoint_hash)
);

CREATE INDEX IF NOT EXISTS subscriptions_expiry ON tp5_push.subscriptions (namespace, expires_at);

CREATE TABLE IF NOT EXISTS tp5_push.rate_limits (
  namespace text NOT NULL,
  scope text NOT NULL,
  bucket bigint NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (namespace, scope)
);

INSERT INTO tp5_push.schema_migrations (version) VALUES (1) ON CONFLICT DO NOTHING;
