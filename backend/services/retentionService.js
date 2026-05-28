const cron = require('node-cron');

const pool = require('../db');

async function runRetentionCleanup() {
    try {
        const metricsResult = await pool.query(`
            DELETE FROM metric_sample
            WHERE collected_at < NOW() - INTERVAL '7 days'
        `);

        const heartbeatResult = await pool.query(`
            DELETE FROM server_heartbeat
            WHERE received_at < NOW() - INTERVAL '7 days'
        `);

        const logsResult = await pool.query(`
            DELETE FROM system_log
            WHERE created_at < NOW() - INTERVAL '14 days'
        `);

        const alertsResult = await pool.query(`
            DELETE FROM alert
            WHERE status = 'resolved'
              AND resolved_at < NOW() - INTERVAL '30 days'
        `);

        console.log('[RETENTION] Limpeza executada', {
            metrics: metricsResult.rowCount,
            heartbeats: heartbeatResult.rowCount,
            logs: logsResult.rowCount,
            alerts: alertsResult.rowCount
        });

    } catch (error) {
        console.error('[RETENTION ERROR]', error);
    }
}

cron.schedule('0 3 * * *', () => {
    runRetentionCleanup();
});

module.exports = {
    runRetentionCleanup
};