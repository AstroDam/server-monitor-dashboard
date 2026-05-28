CREATE INDEX IF NOT EXISTS idx_metric_sample_server_collected
ON metric_sample (server_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_metric_sample_metric_collected
ON metric_sample (metric_name, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_heartbeat_server_received
ON server_heartbeat (server_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_status_raised
ON alert (status, raised_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_rule_status
ON alert (rule_id, status);

CREATE INDEX IF NOT EXISTS idx_system_log_created
ON system_log (created_at DESC);