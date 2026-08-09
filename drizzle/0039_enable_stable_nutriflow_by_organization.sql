-- Production transition: stable NutriFlow capabilities are enabled at organization scope.
-- Future/experimental flags remain off by default and are intentionally not listed here.
INSERT INTO nf_feature_flag_overrides (public_id, flag_key, organization_id, client_id, enabled, variant, reason, expires_at, created_by_auth_user_id, created_at, updated_at)
SELECT 'flag_prod_' || lower(hex(randomblob(12))), flags.flag_key, organization.id, NULL, 1, 'production-stable', 'Transição para operação oficial da organização', NULL, 'system-production-rollout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM nf_organizations AS organization
CROSS JOIN (SELECT 'nutriflow.editor.enabled' AS flag_key UNION ALL SELECT 'nutriflow.catalog.global.enabled' UNION ALL SELECT 'nutriflow.meal_templates.enabled' UNION ALL SELECT 'nutriflow.recipes.enabled' UNION ALL SELECT 'nutriflow.patient_view.enabled') AS flags
WHERE organization.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM nf_feature_flag_overrides AS existing
    WHERE existing.flag_key = flags.flag_key
      AND existing.organization_id = organization.id
      AND existing.client_id IS NULL
  );
