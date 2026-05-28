CREATE TABLE IF NOT EXISTS server_incident (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES server(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    duration_seconds INTEGER,
    reason TEXT DEFAULT 'heartbeat_timeout',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_incident_server_status
ON server_incident (server_id, status);

CREATE INDEX IF NOT EXISTS idx_server_incident_started
ON server_incident (started_at DESC);