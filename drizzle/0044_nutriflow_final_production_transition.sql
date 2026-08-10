-- Final production transition for the Ludgero Sangaletti organization.
-- Stable capabilities are organization-scoped; Training entitlement remains per patient.
UPDATE nf_feature_flag_overrides
SET enabled = 0,
    variant = 'homologation-retired',
    expires_at = '1970-01-01T00:00:00.000Z',
    updated_at = CURRENT_TIMESTAMP
WHERE organization_id = (
    SELECT id FROM nf_organizations
    WHERE public_id = 'org_ludgero_sangaletti' AND status = 'active'
    LIMIT 1
  )
  AND client_id IS NOT NULL
  AND variant IN ('controlled-homologation', 'homologation-suspended');
--> statement-breakpoint
UPDATE nf_feature_flag_overrides
SET enabled = 1,
    variant = 'production-stable',
    reason = 'Operação oficial da organização',
    expires_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE organization_id = (
    SELECT id FROM nf_organizations
    WHERE public_id = 'org_ludgero_sangaletti' AND status = 'active'
    LIMIT 1
  )
  AND client_id IS NULL
  AND flag_key IN (
    'nutriflow.editor.enabled',
    'nutriflow.catalog.global.enabled',
    'nutriflow.meal_templates.enabled',
    'nutriflow.recipes.enabled',
    'nutriflow.patient_view.enabled',
    'nutriflow.training.enabled'
  );
--> statement-breakpoint
INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, variant, reason, expires_at, created_by_auth_user_id, created_at, updated_at)
SELECT 'flag_prod_' || lower(hex(randomblob(12))), 'nutriflow.editor.enabled', organization.id, NULL, 1, 'production-stable', 'Operação oficial da organização', NULL, 'system-production-transition', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM nf_organizations AS organization
WHERE organization.public_id = 'org_ludgero_sangaletti' AND organization.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM nf_feature_flag_overrides AS existing WHERE existing.flag_key = 'nutriflow.editor.enabled' AND existing.organization_id = organization.id AND existing.client_id IS NULL);
--> statement-breakpoint
INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, variant, reason, expires_at, created_by_auth_user_id, created_at, updated_at)
SELECT 'flag_prod_' || lower(hex(randomblob(12))), 'nutriflow.catalog.global.enabled', organization.id, NULL, 1, 'production-stable', 'Operação oficial da organização', NULL, 'system-production-transition', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM nf_organizations AS organization
WHERE organization.public_id = 'org_ludgero_sangaletti' AND organization.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM nf_feature_flag_overrides AS existing WHERE existing.flag_key = 'nutriflow.catalog.global.enabled' AND existing.organization_id = organization.id AND existing.client_id IS NULL);
--> statement-breakpoint
INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, variant, reason, expires_at, created_by_auth_user_id, created_at, updated_at)
SELECT 'flag_prod_' || lower(hex(randomblob(12))), 'nutriflow.meal_templates.enabled', organization.id, NULL, 1, 'production-stable', 'Operação oficial da organização', NULL, 'system-production-transition', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM nf_organizations AS organization
WHERE organization.public_id = 'org_ludgero_sangaletti' AND organization.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM nf_feature_flag_overrides AS existing WHERE existing.flag_key = 'nutriflow.meal_templates.enabled' AND existing.organization_id = organization.id AND existing.client_id IS NULL);
--> statement-breakpoint
INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, variant, reason, expires_at, created_by_auth_user_id, created_at, updated_at)
SELECT 'flag_prod_' || lower(hex(randomblob(12))), 'nutriflow.recipes.enabled', organization.id, NULL, 1, 'production-stable', 'Operação oficial da organização', NULL, 'system-production-transition', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM nf_organizations AS organization
WHERE organization.public_id = 'org_ludgero_sangaletti' AND organization.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM nf_feature_flag_overrides AS existing WHERE existing.flag_key = 'nutriflow.recipes.enabled' AND existing.organization_id = organization.id AND existing.client_id IS NULL);
--> statement-breakpoint
INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, variant, reason, expires_at, created_by_auth_user_id, created_at, updated_at)
SELECT 'flag_prod_' || lower(hex(randomblob(12))), 'nutriflow.patient_view.enabled', organization.id, NULL, 1, 'production-stable', 'Operação oficial da organização', NULL, 'system-production-transition', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM nf_organizations AS organization
WHERE organization.public_id = 'org_ludgero_sangaletti' AND organization.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM nf_feature_flag_overrides AS existing WHERE existing.flag_key = 'nutriflow.patient_view.enabled' AND existing.organization_id = organization.id AND existing.client_id IS NULL);
--> statement-breakpoint
INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, variant, reason, expires_at, created_by_auth_user_id, created_at, updated_at)
SELECT 'flag_prod_' || lower(hex(randomblob(12))), 'nutriflow.training.enabled', organization.id, NULL, 1, 'production-stable', 'Operação oficial da organização', NULL, 'system-production-transition', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM nf_organizations AS organization
WHERE organization.public_id = 'org_ludgero_sangaletti' AND organization.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM nf_feature_flag_overrides AS existing WHERE existing.flag_key = 'nutriflow.training.enabled' AND existing.organization_id = organization.id AND existing.client_id IS NULL);
