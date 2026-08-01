-- NutriFlow Sprint 5: índices aditivos para a leitura do portal do paciente.
-- Nenhuma tabela ou coluna existente é alterada.
CREATE INDEX IF NOT EXISTS `patient_documents_client_type_current_idx`
ON `patient_documents` (`client_email`, `document_type`, `is_current`, `published_at` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `check_ins_client_week_read_idx`
ON `check_ins` (`client_email`, `week_start` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `nf_publications_patient_latest_idx`
ON `nf_publications` (`organization_id`, `client_id`, `status`, `published_at` DESC);

