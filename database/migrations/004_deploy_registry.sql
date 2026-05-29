CREATE TABLE IF NOT EXISTS deploy_registry (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    version VARCHAR(100),

    commit_sha VARCHAR(255),

    status VARCHAR(50),

    smoke_test_passed BOOLEAN DEFAULT FALSE,

    deployed_at TIMESTAMP DEFAULT NOW(),

    notes TEXT

);

CREATE INDEX IF NOT EXISTS idx_deploy_registry_date
ON deploy_registry (deployed_at DESC);