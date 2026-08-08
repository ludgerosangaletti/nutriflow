CREATE TABLE IF NOT EXISTS nf_energy_expenditure_calculations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  organization_id INTEGER NOT NULL REFERENCES nf_organizations(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  protocol_code TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  total_kcal INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_by_auth_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS nf_energy_expenditure_calculations_client_created_idx ON nf_energy_expenditure_calculations(client_id, created_at);
