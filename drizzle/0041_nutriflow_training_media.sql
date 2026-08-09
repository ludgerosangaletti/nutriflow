ALTER TABLE nf_training_exercise_media ADD COLUMN poster_mime_type TEXT;
ALTER TABLE nf_training_exercise_media ADD COLUMN byte_size INTEGER;
ALTER TABLE nf_training_exercise_media ADD COLUMN poster_byte_size INTEGER;
ALTER TABLE nf_training_exercise_media ADD COLUMN replaced_at TEXT;
ALTER TABLE nf_training_exercise_media ADD COLUMN removed_at TEXT;

CREATE INDEX IF NOT EXISTS nf_training_exercise_media_public_id_idx
ON nf_training_exercise_media(public_id);
