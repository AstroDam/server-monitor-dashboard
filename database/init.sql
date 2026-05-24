CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "user_account" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS "server" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  hostname VARCHAR(255),
  ip_address INET,
  tags TEXT[],
  agent_token VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS "metric_sample" (
  id BIGSERIAL PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES server(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit VARCHAR(20),
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metric_server_time
ON metric_sample(server_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_metric_name_time
ON metric_sample(metric_name, collected_at DESC);

CREATE TABLE IF NOT EXISTS "service_status" (
  id BIGSERIAL PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES server(id) ON DELETE CASCADE,
  service_name VARCHAR(150) NOT NULL,
  status VARCHAR(30) NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_service_server_time
ON service_status(server_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS "alert_rule" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  server_id UUID,
  metric_name VARCHAR(100) NOT NULL,
  operator VARCHAR(4) NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  duration_seconds INT DEFAULT 0,
  channels TEXT[],
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_account(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "alert" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rule(id),
  server_id UUID REFERENCES server(id),
  metric_name VARCHAR(100),
  value DOUBLE PRECISION,
  raised_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(30) DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS "dashboard_config" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_account(id) ON DELETE CASCADE,
  refresh_interval_seconds INT DEFAULT 5,
  widgets JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "server_heartbeat" (
  id BIGSERIAL PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES server(id) ON DELETE CASCADE,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "system_log" (
  id BIGSERIAL PRIMARY KEY,
  server_id UUID REFERENCES server(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO server (
  name,
  hostname,
  ip_address,
  agent_token
)
VALUES (
  'Docker Agent',
  'monitor_agent',
  '127.0.0.1',
  'agent-local-123'
)
ON CONFLICT DO NOTHING;