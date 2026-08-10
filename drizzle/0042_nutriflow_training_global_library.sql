-- NutriFlow Training Global Library 1.0.
-- Reconciles the 12 historical identifiers and adds only the 88 missing global exercises.
-- The validation guard aborts the migration if the resulting global catalog is not exactly the approved set.

UPDATE nf_training_exercises
SET name = 'Supino reto com barra', primary_muscle_group = 'peito', aliases_json = '["supino-reto-barra"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_supino_reto' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Crucifixo reto com halteres', primary_muscle_group = 'peito', aliases_json = '["crucifixo-reto-halteres"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_crucifixo' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Puxada frontal pronada', primary_muscle_group = 'costas', aliases_json = '["puxada-frontal-pronada"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_puxada_frente' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Remada baixa no cabo', primary_muscle_group = 'costas', aliases_json = '["remada-baixa-cabo"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_remada_baixa' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Desenvolvimento com halteres', primary_muscle_group = 'ombros', aliases_json = '["desenvolvimento-halteres"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_desenvolvimento' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Rosca direta com barra', primary_muscle_group = 'biceps', aliases_json = '["rosca-direta-barra"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_rosca_direta' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Tríceps pulley com corda', primary_muscle_group = 'triceps', aliases_json = '["triceps-pulley-corda"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_triceps_pulley' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Agachamento livre', primary_muscle_group = 'quadriceps', aliases_json = '["agachamento-livre"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_agachamento' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Leg press 45°', primary_muscle_group = 'quadriceps', aliases_json = '["leg-press-45"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_leg_press' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Mesa flexora', primary_muscle_group = 'posterior_coxa', aliases_json = '["mesa-flexora"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_mesa_flexora' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Panturrilha em pé', primary_muscle_group = 'panturrilhas', aliases_json = '["panturrilha-em-pe"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_elevacao_panturrilha' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Prancha', primary_muscle_group = 'core', aliases_json = '["prancha"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_prancha' AND scope = 'global' AND organization_id IS NULL;

INSERT INTO nf_training_exercises
  (public_id, organization_id, scope, name, primary_muscle_group, aliases_json, instructions, status, created_by_auth_user_id)
VALUES
  ('tr_ex_global_supino-inclinado-barra', NULL, 'global', 'Supino inclinado com barra', 'peito', '["supino-inclinado-barra"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_supino-reto-halteres', NULL, 'global', 'Supino reto com halteres', 'peito', '["supino-reto-halteres"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_supino-inclinado-halteres', NULL, 'global', 'Supino inclinado com halteres', 'peito', '["supino-inclinado-halteres"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_crucifixo-inclinado-halteres', NULL, 'global', 'Crucifixo inclinado com halteres', 'peito', '["crucifixo-inclinado-halteres"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_crossover-cabo', NULL, 'global', 'Crossover no cabo', 'peito', '["crossover-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_peck-deck', NULL, 'global', 'Peck deck', 'peito', '["peck-deck"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_chest-press-maquina', NULL, 'global', 'Chest press máquina', 'peito', '["chest-press-maquina"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_flexao-bracos', NULL, 'global', 'Flexão de braços', 'peito', '["flexao-bracos"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_puxada-frontal-neutra', NULL, 'global', 'Puxada frontal neutra', 'costas', '["puxada-frontal-neutra"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_barra-fixa', NULL, 'global', 'Barra fixa', 'costas', '["barra-fixa"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_remada-curvada-barra', NULL, 'global', 'Remada curvada com barra', 'costas', '["remada-curvada-barra"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_remada-unilateral-halter', NULL, 'global', 'Remada unilateral com halter', 'costas', '["remada-unilateral-halter"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_remada-articulada-maquina', NULL, 'global', 'Remada articulada máquina', 'costas', '["remada-articulada-maquina"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_remada-t-bar', NULL, 'global', 'Remada T-bar', 'costas', '["remada-t-bar"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_pulldown-unilateral', NULL, 'global', 'Pulldown unilateral', 'costas', '["pulldown-unilateral"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_pullover-cabo', NULL, 'global', 'Pullover no cabo', 'costas', '["pullover-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_desenvolvimento-barra', NULL, 'global', 'Desenvolvimento com barra', 'ombros', '["desenvolvimento-barra"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_desenvolvimento-maquina', NULL, 'global', 'Desenvolvimento máquina', 'ombros', '["desenvolvimento-maquina"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_elevacao-lateral-halteres', NULL, 'global', 'Elevação lateral com halteres', 'ombros', '["elevacao-lateral-halteres"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_elevacao-lateral-cabo', NULL, 'global', 'Elevação lateral no cabo', 'ombros', '["elevacao-lateral-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_elevacao-lateral-maquina', NULL, 'global', 'Elevação lateral máquina', 'ombros', '["elevacao-lateral-maquina"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_elevacao-frontal', NULL, 'global', 'Elevação frontal', 'ombros', '["elevacao-frontal"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_crucifixo-inverso', NULL, 'global', 'Crucifixo inverso', 'ombros', '["crucifixo-inverso"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_face-pull', NULL, 'global', 'Face pull', 'ombros', '["face-pull"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_remada-alta', NULL, 'global', 'Remada alta', 'ombros', '["remada-alta"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_rosca-direta-ez', NULL, 'global', 'Rosca direta barra EZ', 'biceps', '["rosca-direta-ez"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_rosca-alternada', NULL, 'global', 'Rosca alternada', 'biceps', '["rosca-alternada"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_rosca-simultanea-halteres', NULL, 'global', 'Rosca simultânea com halteres', 'biceps', '["rosca-simultanea-halteres"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_rosca-martelo', NULL, 'global', 'Rosca martelo', 'biceps', '["rosca-martelo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_rosca-scott', NULL, 'global', 'Rosca Scott', 'biceps', '["rosca-scott"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_rosca-cabo', NULL, 'global', 'Rosca no cabo', 'biceps', '["rosca-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_rosca-concentrada', NULL, 'global', 'Rosca concentrada', 'biceps', '["rosca-concentrada"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_rosca-inclinada-halteres', NULL, 'global', 'Rosca inclinada com halteres', 'biceps', '["rosca-inclinada-halteres"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_rosca-bayesian', NULL, 'global', 'Rosca Bayesian', 'biceps', '["rosca-bayesian"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_triceps-pulley-barra', NULL, 'global', 'Tríceps pulley com barra', 'triceps', '["triceps-pulley-barra"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_triceps-frances-halter', NULL, 'global', 'Tríceps francês com halter', 'triceps', '["triceps-frances-halter"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_triceps-testa', NULL, 'global', 'Tríceps testa', 'triceps', '["triceps-testa"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_triceps-unilateral-cabo', NULL, 'global', 'Tríceps unilateral no cabo', 'triceps', '["triceps-unilateral-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_triceps-overhead-cabo', NULL, 'global', 'Tríceps acima da cabeça no cabo', 'triceps', '["triceps-overhead-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_supino-fechado', NULL, 'global', 'Supino fechado', 'triceps', '["supino-fechado"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_paralelas', NULL, 'global', 'Paralelas', 'triceps', '["paralelas"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_triceps-maquina', NULL, 'global', 'Tríceps máquina', 'triceps', '["triceps-maquina"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_coice-halter', NULL, 'global', 'Coice com halter', 'triceps', '["coice-halter"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_agachamento-frontal', NULL, 'global', 'Agachamento frontal', 'quadriceps', '["agachamento-frontal"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_hack-squat', NULL, 'global', 'Hack squat', 'quadriceps', '["hack-squat"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_leg-press-horizontal', NULL, 'global', 'Leg press horizontal', 'quadriceps', '["leg-press-horizontal"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_cadeira-extensora', NULL, 'global', 'Cadeira extensora', 'quadriceps', '["cadeira-extensora"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_afundo', NULL, 'global', 'Afundo', 'quadriceps', '["afundo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_passada', NULL, 'global', 'Passada', 'quadriceps', '["passada"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_agachamento-bulgaro', NULL, 'global', 'Agachamento búlgaro', 'quadriceps', '["agachamento-bulgaro"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_goblet-squat', NULL, 'global', 'Goblet squat', 'quadriceps', '["goblet-squat"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_cadeira-flexora', NULL, 'global', 'Cadeira flexora', 'posterior_coxa', '["cadeira-flexora"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_flexora-unilateral', NULL, 'global', 'Flexora unilateral', 'posterior_coxa', '["flexora-unilateral"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_stiff-barra', NULL, 'global', 'Stiff com barra', 'posterior_coxa', '["stiff-barra"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_stiff-halteres', NULL, 'global', 'Stiff com halteres', 'posterior_coxa', '["stiff-halteres"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_levantamento-terra-romeno', NULL, 'global', 'Levantamento terra romeno', 'posterior_coxa', '["levantamento-terra-romeno"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_good-morning', NULL, 'global', 'Good morning', 'posterior_coxa', '["good-morning"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_nordic-curl', NULL, 'global', 'Nordic curl', 'posterior_coxa', '["nordic-curl"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_levantamento-terra', NULL, 'global', 'Levantamento terra', 'posterior_coxa', '["levantamento-terra"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_pull-through-cabo', NULL, 'global', 'Pull-through no cabo', 'posterior_coxa', '["pull-through-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_hip-thrust', NULL, 'global', 'Hip thrust', 'gluteos', '["hip-thrust"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_elevacao-pelvica', NULL, 'global', 'Elevação pélvica', 'gluteos', '["elevacao-pelvica"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_glute-bridge', NULL, 'global', 'Glute bridge', 'gluteos', '["glute-bridge"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_coice-cabo', NULL, 'global', 'Coice no cabo', 'gluteos', '["coice-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_abducao-maquina', NULL, 'global', 'Abdução na máquina', 'gluteos', '["abducao-maquina"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_abducao-cabo', NULL, 'global', 'Abdução no cabo', 'gluteos', '["abducao-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_step-up', NULL, 'global', 'Step-up', 'gluteos', '["step-up"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_afundo-reverso', NULL, 'global', 'Afundo reverso', 'gluteos', '["afundo-reverso"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_extensao-quadril-maquina', NULL, 'global', 'Extensão de quadril máquina', 'gluteos', '["extensao-quadril-maquina"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_caminhada-lateral-miniband', NULL, 'global', 'Caminhada lateral com miniband', 'gluteos', '["caminhada-lateral-miniband"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_panturrilha-sentada', NULL, 'global', 'Panturrilha sentada', 'panturrilhas', '["panturrilha-sentada"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_panturrilha-leg-press', NULL, 'global', 'Panturrilha no leg press', 'panturrilhas', '["panturrilha-leg-press"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_panturrilha-unilateral', NULL, 'global', 'Panturrilha unilateral', 'panturrilhas', '["panturrilha-unilateral"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_panturrilha-smith', NULL, 'global', 'Panturrilha no Smith', 'panturrilhas', '["panturrilha-smith"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_panturrilha-hack', NULL, 'global', 'Panturrilha no hack', 'panturrilhas', '["panturrilha-hack"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_crunch-abdominal', NULL, 'global', 'Crunch abdominal', 'core', '["crunch-abdominal"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_crunch-cabo', NULL, 'global', 'Crunch no cabo', 'core', '["crunch-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_elevacao-pernas', NULL, 'global', 'Elevação de pernas', 'core', '["elevacao-pernas"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_elevacao-joelhos-suspenso', NULL, 'global', 'Elevação de joelhos suspenso', 'core', '["elevacao-joelhos-suspenso"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_prancha-lateral', NULL, 'global', 'Prancha lateral', 'core', '["prancha-lateral"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_ab-wheel', NULL, 'global', 'Ab wheel', 'core', '["ab-wheel"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_pallof-press', NULL, 'global', 'Pallof press', 'core', '["pallof-press"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_cadeira-adutora', NULL, 'global', 'Cadeira adutora', 'adutores_abdutores', '["cadeira-adutora"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_cadeira-abdutora', NULL, 'global', 'Cadeira abdutora', 'adutores_abdutores', '["cadeira-abdutora"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_aducao-cabo', NULL, 'global', 'Adução no cabo', 'adutores_abdutores', '["aducao-cabo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_abducao-cabo-em-pe', NULL, 'global', 'Abdução no cabo em pé', 'adutores_abdutores', '["abducao-cabo-em-pe"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_clamshell', NULL, 'global', 'Clamshell', 'adutores_abdutores', '["clamshell"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_copenhagen-plank', NULL, 'global', 'Copenhagen plank', 'adutores_abdutores', '["copenhagen-plank"]', NULL, 'active', 'system-training-library')
ON CONFLICT(public_id) DO NOTHING;

CREATE TEMP TABLE nf_training_catalog_0042_guard (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO nf_training_catalog_0042_guard (ok)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM nf_training_exercises WHERE scope = 'global' AND organization_id IS NULL) = 100
  AND (SELECT COUNT(DISTINCT public_id) FROM nf_training_exercises WHERE scope = 'global' AND organization_id IS NULL) = 100
  AND (SELECT COUNT(*) FROM nf_training_exercises WHERE scope = 'global' AND organization_id IS NULL AND public_id NOT IN (
    'tr_ex_global_supino_reto',
    'tr_ex_global_supino-inclinado-barra',
    'tr_ex_global_supino-reto-halteres',
    'tr_ex_global_supino-inclinado-halteres',
    'tr_ex_global_crucifixo',
    'tr_ex_global_crucifixo-inclinado-halteres',
    'tr_ex_global_crossover-cabo',
    'tr_ex_global_peck-deck',
    'tr_ex_global_chest-press-maquina',
    'tr_ex_global_flexao-bracos',
    'tr_ex_global_puxada_frente',
    'tr_ex_global_puxada-frontal-neutra',
    'tr_ex_global_barra-fixa',
    'tr_ex_global_remada-curvada-barra',
    'tr_ex_global_remada-unilateral-halter',
    'tr_ex_global_remada_baixa',
    'tr_ex_global_remada-articulada-maquina',
    'tr_ex_global_remada-t-bar',
    'tr_ex_global_pulldown-unilateral',
    'tr_ex_global_pullover-cabo',
    'tr_ex_global_desenvolvimento',
    'tr_ex_global_desenvolvimento-barra',
    'tr_ex_global_desenvolvimento-maquina',
    'tr_ex_global_elevacao-lateral-halteres',
    'tr_ex_global_elevacao-lateral-cabo',
    'tr_ex_global_elevacao-lateral-maquina',
    'tr_ex_global_elevacao-frontal',
    'tr_ex_global_crucifixo-inverso',
    'tr_ex_global_face-pull',
    'tr_ex_global_remada-alta',
    'tr_ex_global_rosca_direta',
    'tr_ex_global_rosca-direta-ez',
    'tr_ex_global_rosca-alternada',
    'tr_ex_global_rosca-simultanea-halteres',
    'tr_ex_global_rosca-martelo',
    'tr_ex_global_rosca-scott',
    'tr_ex_global_rosca-cabo',
    'tr_ex_global_rosca-concentrada',
    'tr_ex_global_rosca-inclinada-halteres',
    'tr_ex_global_rosca-bayesian',
    'tr_ex_global_triceps-pulley-barra',
    'tr_ex_global_triceps_pulley',
    'tr_ex_global_triceps-frances-halter',
    'tr_ex_global_triceps-testa',
    'tr_ex_global_triceps-unilateral-cabo',
    'tr_ex_global_triceps-overhead-cabo',
    'tr_ex_global_supino-fechado',
    'tr_ex_global_paralelas',
    'tr_ex_global_triceps-maquina',
    'tr_ex_global_coice-halter',
    'tr_ex_global_agachamento',
    'tr_ex_global_agachamento-frontal',
    'tr_ex_global_hack-squat',
    'tr_ex_global_leg_press',
    'tr_ex_global_leg-press-horizontal',
    'tr_ex_global_cadeira-extensora',
    'tr_ex_global_afundo',
    'tr_ex_global_passada',
    'tr_ex_global_agachamento-bulgaro',
    'tr_ex_global_goblet-squat',
    'tr_ex_global_mesa_flexora',
    'tr_ex_global_cadeira-flexora',
    'tr_ex_global_flexora-unilateral',
    'tr_ex_global_stiff-barra',
    'tr_ex_global_stiff-halteres',
    'tr_ex_global_levantamento-terra-romeno',
    'tr_ex_global_good-morning',
    'tr_ex_global_nordic-curl',
    'tr_ex_global_levantamento-terra',
    'tr_ex_global_pull-through-cabo',
    'tr_ex_global_hip-thrust',
    'tr_ex_global_elevacao-pelvica',
    'tr_ex_global_glute-bridge',
    'tr_ex_global_coice-cabo',
    'tr_ex_global_abducao-maquina',
    'tr_ex_global_abducao-cabo',
    'tr_ex_global_step-up',
    'tr_ex_global_afundo-reverso',
    'tr_ex_global_extensao-quadril-maquina',
    'tr_ex_global_caminhada-lateral-miniband',
    'tr_ex_global_elevacao_panturrilha',
    'tr_ex_global_panturrilha-sentada',
    'tr_ex_global_panturrilha-leg-press',
    'tr_ex_global_panturrilha-unilateral',
    'tr_ex_global_panturrilha-smith',
    'tr_ex_global_panturrilha-hack',
    'tr_ex_global_crunch-abdominal',
    'tr_ex_global_crunch-cabo',
    'tr_ex_global_elevacao-pernas',
    'tr_ex_global_elevacao-joelhos-suspenso',
    'tr_ex_global_prancha',
    'tr_ex_global_prancha-lateral',
    'tr_ex_global_ab-wheel',
    'tr_ex_global_pallof-press',
    'tr_ex_global_cadeira-adutora',
    'tr_ex_global_cadeira-abdutora',
    'tr_ex_global_aducao-cabo',
    'tr_ex_global_abducao-cabo-em-pe',
    'tr_ex_global_clamshell',
    'tr_ex_global_copenhagen-plank'
  )) = 0
THEN 1 ELSE 0 END;

DROP TABLE nf_training_catalog_0042_guard;
