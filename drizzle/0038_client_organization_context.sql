ALTER TABLE clients ADD COLUMN organization_id INTEGER REFERENCES nf_organizations(id);
CREATE INDEX IF NOT EXISTS clients_organization_idx ON clients(organization_id);
