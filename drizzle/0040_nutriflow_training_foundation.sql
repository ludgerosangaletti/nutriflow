CREATE TABLE IF NOT EXISTS nf_training_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, public_id TEXT NOT NULL UNIQUE,
  organization_id INTEGER NOT NULL REFERENCES nf_organizations(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'inactive', granted_by_auth_user_id TEXT, granted_at TEXT,
  revoked_by_auth_user_id TEXT, revoked_at TEXT, reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, client_id)
);
CREATE INDEX IF NOT EXISTS nf_training_entitlements_org_status_idx ON nf_training_entitlements(organization_id, status);

CREATE TABLE IF NOT EXISTS nf_training_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT, public_id TEXT NOT NULL UNIQUE,
  organization_id INTEGER REFERENCES nf_organizations(id) ON DELETE RESTRICT,
  scope TEXT NOT NULL, name TEXT NOT NULL, primary_muscle_group TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]', instructions TEXT, status TEXT NOT NULL DEFAULT 'active',
  created_by_auth_user_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((scope = 'global' AND organization_id IS NULL) OR (scope = 'organization' AND organization_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS nf_training_exercises_lookup_idx ON nf_training_exercises(scope, organization_id, primary_muscle_group, status);
CREATE INDEX IF NOT EXISTS nf_training_exercises_name_idx ON nf_training_exercises(name);

CREATE TABLE IF NOT EXISTS nf_training_exercise_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT, public_id TEXT NOT NULL UNIQUE,
  exercise_id INTEGER NOT NULL REFERENCES nf_training_exercises(id) ON DELETE RESTRICT,
  media_kind TEXT NOT NULL DEFAULT 'video', object_key TEXT NOT NULL, poster_object_key TEXT,
  mime_type TEXT NOT NULL, duration_ms INTEGER, status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS nf_training_exercise_media_active_idx ON nf_training_exercise_media(exercise_id, status);

CREATE TABLE IF NOT EXISTS nf_training_routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT, public_id TEXT NOT NULL UNIQUE,
  organization_id INTEGER NOT NULL REFERENCES nf_organizations(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_by_auth_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS nf_training_routines_org_client_idx ON nf_training_routines(organization_id, client_id, status);

CREATE TABLE IF NOT EXISTS nf_training_routine_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, public_id TEXT NOT NULL UNIQUE,
  routine_id INTEGER NOT NULL REFERENCES nf_training_routines(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1, schema_version INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'draft', content_json TEXT, snapshot_json TEXT, content_hash TEXT,
  created_by_auth_user_id TEXT NOT NULL, published_by_auth_user_id TEXT, published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(routine_id, version_number)
);
CREATE INDEX IF NOT EXISTS nf_training_routine_versions_state_idx ON nf_training_routine_versions(routine_id, state);

CREATE TABLE IF NOT EXISTS nf_training_publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, public_id TEXT NOT NULL UNIQUE,
  organization_id INTEGER NOT NULL REFERENCES nf_organizations(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  routine_id INTEGER NOT NULL REFERENCES nf_training_routines(id) ON DELETE RESTRICT,
  routine_version_id INTEGER NOT NULL REFERENCES nf_training_routine_versions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active', published_by_auth_user_id TEXT NOT NULL, published_at TEXT NOT NULL,
  revoked_by_auth_user_id TEXT, revoked_at TEXT, revocation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS nf_training_publications_org_client_status_idx ON nf_training_publications(organization_id, client_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS nf_training_publications_one_active_client_idx ON nf_training_publications(organization_id, client_id) WHERE status = 'active';

CREATE TRIGGER IF NOT EXISTS nf_training_routine_versions_published_update_guard
BEFORE UPDATE ON nf_training_routine_versions
WHEN OLD.state = 'published'
BEGIN
  SELECT RAISE(ABORT, 'NF_PUBLICATION_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS nf_training_routine_versions_published_delete_guard
BEFORE DELETE ON nf_training_routine_versions
WHEN OLD.state = 'published'
BEGIN
  SELECT RAISE(ABORT, 'NF_PUBLICATION_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS nf_training_publications_delete_guard
BEFORE DELETE ON nf_training_publications
BEGIN
  SELECT RAISE(ABORT, 'NF_PUBLICATION_IMMUTABLE');
END;

-- D1 limits compound SELECT terms, so use a bounded multi-row insert.
-- public_id is unique, preserving repeat-safe seeding.
INSERT INTO nf_training_exercises (public_id, organization_id, scope, name, primary_muscle_group, aliases_json, instructions, status, created_by_auth_user_id) VALUES
  ('tr_ex_global_supino_reto', NULL, 'global', 'Supino reto', 'peito', '["supino barra"]', 'Mantenha escápulas apoiadas e controle a descida.', 'active', 'system-training-library'),
  ('tr_ex_global_crucifixo', NULL, 'global', 'Crucifixo com halteres', 'peito', '["crucifixo"]', 'Movimento controlado, sem perder a posição dos ombros.', 'active', 'system-training-library'),
  ('tr_ex_global_puxada_frente', NULL, 'global', 'Puxada frontal', 'costas', '["pulldown"]', 'Puxe em direção ao peito mantendo o tronco estável.', 'active', 'system-training-library'),
  ('tr_ex_global_remada_baixa', NULL, 'global', 'Remada baixa', 'costas', '["remada sentada"]', 'Conduza os cotovelos para trás sem compensar com o tronco.', 'active', 'system-training-library'),
  ('tr_ex_global_desenvolvimento', NULL, 'global', 'Desenvolvimento com halteres', 'ombros', '["desenvolvimento"]', 'Mantenha o abdômen ativo durante o movimento.', 'active', 'system-training-library'),
  ('tr_ex_global_rosca_direta', NULL, 'global', 'Rosca direta', 'biceps', '["rosca barra"]', 'Evite balanço do tronco e controle a descida.', 'active', 'system-training-library'),
  ('tr_ex_global_triceps_pulley', NULL, 'global', 'Tríceps pulley', 'triceps', '["triceps corda"]', 'Mantenha os cotovelos próximos ao corpo.', 'active', 'system-training-library'),
  ('tr_ex_global_agachamento', NULL, 'global', 'Agachamento livre', 'quadriceps', '["agachamento"]', 'Mantenha os joelhos alinhados e a coluna neutra.', 'active', 'system-training-library'),
  ('tr_ex_global_leg_press', NULL, 'global', 'Leg press', 'quadriceps', '["leg press 45"]', 'Controle a amplitude sem retirar o quadril do apoio.', 'active', 'system-training-library'),
  ('tr_ex_global_mesa_flexora', NULL, 'global', 'Mesa flexora', 'posterior_coxa', '["flexora deitada"]', 'Controle o retorno e evite elevar o quadril.', 'active', 'system-training-library'),
  ('tr_ex_global_elevacao_panturrilha', NULL, 'global', 'Elevação de panturrilha', 'panturrilhas', '["panturrilha em pé"]', 'Use amplitude confortável e movimento controlado.', 'active', 'system-training-library'),
  ('tr_ex_global_prancha', NULL, 'global', 'Prancha isométrica', 'core', '["plank"]', 'Mantenha alinhamento entre ombros, quadril e calcanhares.', 'active', 'system-training-library')
ON CONFLICT(public_id) DO NOTHING;
