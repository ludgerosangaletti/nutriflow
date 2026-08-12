-- NutriFlow Training: expansão pontual da Biblioteca Global com Abdômen e Cardio.
-- Reconciliamos somente quatro exercícios semanticamente equivalentes e preservamos seus public_id.

UPDATE nf_training_exercises
SET name = 'Abdominal crunch', primary_muscle_group = 'abdomen', aliases_json = '["crunch-abdominal","abdominal-crunch"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_crunch-abdominal' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Abdominal crunch no cabo', primary_muscle_group = 'abdomen', aliases_json = '["crunch-cabo","abdominal-crunch-cabo","cable-crunch"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_crunch-cabo' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Elevação de pernas na barra', primary_muscle_group = 'abdomen', aliases_json = '["elevacao-pernas","elevacao-pernas-barra","hanging-leg-raise"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_elevacao-pernas' AND scope = 'global' AND organization_id IS NULL;

UPDATE nf_training_exercises
SET name = 'Elevação de joelhos na barra', primary_muscle_group = 'abdomen', aliases_json = '["elevacao-joelhos-suspenso","elevacao-joelhos-barra","hanging-knee-raise"]', updated_at = CURRENT_TIMESTAMP
WHERE public_id = 'tr_ex_global_elevacao-joelhos-suspenso' AND scope = 'global' AND organization_id IS NULL;

INSERT INTO nf_training_exercises
  (public_id, organization_id, scope, name, primary_muscle_group, aliases_json, instructions, status, created_by_auth_user_id)
VALUES
  ('tr_ex_global_crunch-maquina', NULL, 'global', 'Abdominal crunch na máquina', 'abdomen', '["crunch-maquina","abdominal-crunch-maquina"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_abdominal-infra-solo', NULL, 'global', 'Abdominal infra no solo', 'abdomen', '["abdominal-infra-solo"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_elevacao-pernas-deitado', NULL, 'global', 'Elevação de pernas deitado', 'abdomen', '["elevacao-pernas-deitado","lying-leg-raise"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_abdominal-bicicleta', NULL, 'global', 'Abdominal bicicleta', 'abdomen', '["abdominal-bicicleta","bicycle-crunch"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_abdominal-reverso', NULL, 'global', 'Abdominal reverso', 'abdomen', '["abdominal-reverso","reverse-crunch"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_abdominal-obliquo', NULL, 'global', 'Abdominal oblíquo', 'abdomen', '["abdominal-obliquo","cross-body-crunch"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_esteira', NULL, 'global', 'Esteira', 'cardio', '["esteira","treadmill"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_bicicleta', NULL, 'global', 'Bicicleta', 'cardio', '["bicicleta","bicicleta-ergometrica","stationary-bike"]', NULL, 'active', 'system-training-library'),
  ('tr_ex_global_escada', NULL, 'global', 'Escada', 'cardio', '["escada","maquina-de-escada","stair-climber"]', NULL, 'active', 'system-training-library')
ON CONFLICT(public_id) DO NOTHING;
