CREATE TABLE IF NOT EXISTS deploy_incident_correlation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    deploy_id UUID NOT NULL
    REFERENCES deploy_registry(id)
    ON DELETE CASCADE,

    incident_id UUID NOT NULL
    REFERENCES server_incident(id)
    ON DELETE CASCADE,

    correlation_score INTEGER DEFAULT 100,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correlation_deploy
ON deploy_incident_correlation(deploy_id);

CREATE INDEX IF NOT EXISTS idx_correlation_incident
ON deploy_incident_correlation(incident_id);