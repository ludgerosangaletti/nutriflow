CREATE TABLE IF NOT EXISTS nf_clinical_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  organization_id INTEGER NOT NULL REFERENCES nf_organizations(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  protocol_code TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  weight_kg TEXT NOT NULL,
  height_cm TEXT NOT NULL,
  bmi TEXT NOT NULL,
  body_fat_pct TEXT NOT NULL,
  fat_mass_kg TEXT NOT NULL,
  lean_mass_kg TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_by_auth_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, content_hash)
);
CREATE INDEX IF NOT EXISTS nf_clinical_assessments_client_date_idx ON nf_clinical_assessments(client_id, captured_at);
