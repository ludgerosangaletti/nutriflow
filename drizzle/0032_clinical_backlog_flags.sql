INSERT OR IGNORE INTO nf_feature_flags (flag_key, description, default_enabled, created_at, updated_at) VALUES
('nutriflow.plan_publication_notifications.enabled', 'Notifica publicação de plano por e-mail e WhatsApp', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nutriflow.checkin_feedback.enabled', 'Feedback opcional do nutricionista no check-in', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nutriflow.meal_options.enabled', 'Exibe uma opção de refeição por vez no portal', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('nutriflow.smart_substitutions.enabled', 'Sugestões nutricionalmente equivalentes da biblioteca oficial', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
