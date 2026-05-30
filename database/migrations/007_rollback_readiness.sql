ALTER TABLE deploy_registry
ADD COLUMN IF NOT EXISTS rollback_recommended BOOLEAN DEFAULT false;

ALTER TABLE deploy_registry
ADD COLUMN IF NOT EXISTS rollback_reason TEXT;