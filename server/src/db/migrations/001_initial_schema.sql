-- Initial schema for the BIAI admissions CRM.

-- gen_random_uuid() is built in from PostgreSQL 13. Shared hosts (cPanel) often
-- run PostgreSQL 12 without the pgcrypto extension, so define a fallback there.
-- It returns a valid version-4 UUID (version and variant digits set), because
-- the API validates ids strictly.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid') THEN
    CREATE FUNCTION gen_random_uuid() RETURNS uuid
      LANGUAGE sql VOLATILE
      AS $f$
        SELECT (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3) || '-' ||
                substr('89ab', floor(random() * 4)::int + 1, 1) || substr(h, 18, 3) || '-' ||
                substr(h, 21, 12))::uuid
        FROM (SELECT md5(random()::text || clock_timestamp()::text) AS h) AS s
      $f$;
  END IF;
END
$$;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('Admin', 'Admissions', 'Support', 'Sales')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  program         TEXT NOT NULL DEFAULT 'Unspecified'
                  CHECK (program IN ('Bootcamp', 'Fellowship', 'Corporate training', 'Unspecified')),
  route           TEXT NOT NULL DEFAULT 'Sales'
                  CHECK (route IN ('Sales', 'Support', 'Careers', 'Spam')),
  language        TEXT NOT NULL DEFAULT 'English'
                  CHECK (language IN ('English', 'Bangla', 'Banglish')),
  status          TEXT NOT NULL DEFAULT 'New'
                  CHECK (status IN ('New', 'Contacted', 'Interested', 'Paid', 'Lost')),
  support_status  TEXT NOT NULL DEFAULT 'Open' CHECK (support_status IN ('Open', 'Resolved')),
  priority        TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Urgent')),
  owner           TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  next_action     TEXT NOT NULL DEFAULT '',
  next_follow_up  TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  draft           TEXT NOT NULL DEFAULT '',
  draft_mode      TEXT NOT NULL DEFAULT 'manual',
  analysis_reason TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One contact per phone number; blank phones never merge.
CREATE UNIQUE INDEX leads_phone_unique ON leads (phone) WHERE phone <> '';
CREATE INDEX leads_status_idx ON leads (status);
CREATE INDEX leads_route_idx ON leads (route);

CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  channel     TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  source_id   TEXT,
  sender      TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_lead_idx ON messages (lead_id, received_at);
CREATE UNIQUE INDEX messages_source_unique ON messages (source_id) WHERE source_id IS NOT NULL;

CREATE TABLE activity_log (
  id         BIGSERIAL PRIMARY KEY,
  lead_id    UUID NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  author     TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_lead_idx ON activity_log (lead_id, created_at);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE automation_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key   TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL CHECK (status IN ('Processing', 'Pending', 'Completed', 'Approved', 'Rejected', 'Failed')),
  mode         TEXT NOT NULL,
  input        JSONB NOT NULL,
  result       JSONB,
  reasons      JSONB NOT NULL DEFAULT '[]',
  error        TEXT NOT NULL DEFAULT '',
  lead_id      UUID REFERENCES leads (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX automation_jobs_created_idx ON automation_jobs (created_at DESC);
