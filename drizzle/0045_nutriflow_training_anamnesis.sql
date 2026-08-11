CREATE TABLE IF NOT EXISTS nf_training_anamneses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  organization_id INTEGER NOT NULL REFERENCES nf_organizations(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  schema_version INTEGER NOT NULL DEFAULT 1,
  answers_json TEXT NOT NULL DEFAULT '{}',
  submitted_answers_json TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, client_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS nf_training_anamneses_org_status_idx ON nf_training_anamneses(organization_id, status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS nf_training_anamnesis_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  anamnesis_id INTEGER NOT NULL REFERENCES nf_training_anamneses(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  answers_json TEXT NOT NULL,
  submitted_by_auth_user_id TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  UNIQUE(anamnesis_id, revision)
);
