ALTER TABLE nf_training_exercise_media ADD COLUMN content_sha256 TEXT;
ALTER TABLE nf_training_exercise_media ADD COLUMN poster_sha256 TEXT;
ALTER TABLE nf_training_exercise_media ADD COLUMN source_url TEXT;
ALTER TABLE nf_training_exercise_media ADD COLUMN credit TEXT;
ALTER TABLE nf_training_exercise_media ADD COLUMN license TEXT;
ALTER TABLE nf_training_exercise_media ADD COLUMN license_url TEXT;

CREATE INDEX IF NOT EXISTS nf_training_exercise_media_hash_idx
ON nf_training_exercise_media(exercise_id, content_sha256, poster_sha256);
