const cron = require('node-cron');

const pool = require('../db');

const {
    correlateIncident
} = require('./deployCorrelationService');

async function checkIncidents() {
    try {
        const result = await pool.query(`
            SELECT
                s.id,
                s.hostname,
                MAX(sh.received_at) AS last_heartbeat_at
            FROM server s
            LEFT JOIN server_heartbeat sh
                ON sh.server_id = s.id
            GROUP BY s.id, s.hostname
        `);

        for (const server of result.rows) {
            const isOnline =
                server.last_heartbeat_at &&
                new Date(server.last_heartbeat_at) >=
                    new Date(Date.now() - 30000);

            const openIncidentResult = await pool.query(`
                SELECT *
                FROM server_incident
                WHERE server_id = $1
                  AND status = 'open'
                LIMIT 1
            `, [server.id]);

            const openIncident = openIncidentResult.rows[0];

            if (!isOnline && !openIncident) {
                const incidentResult = await pool.query(`
                    INSERT INTO server_incident (
                        server_id,
                        status,
                        reason
                    )
                    VALUES ($1, $2, $3)
                    RETURNING *
                `, [
                    server.id,
                    'open',
                    'heartbeat_timeout'
                ]);

                const incident = incidentResult.rows[0];

                await correlateIncident(
                    incident.id,
                    incident.started_at
                );

                console.log(
                    `[INCIDENT] Aberto para ${server.hostname}`
                );
            }

            if (isOnline && openIncident) {
                const durationSeconds = Math.floor(
                    (
                        Date.now() -
                        new Date(openIncident.started_at).getTime()
                    ) / 1000
                );

                await pool.query(`
                    UPDATE server_incident
                    SET status = 'resolved',
                        resolved_at = NOW(),
                        duration_seconds = $1
                    WHERE id = $2
                `, [
                    durationSeconds,
                    openIncident.id
                ]);

                console.log(
                    `[INCIDENT] Resolvido para ${server.hostname}`
                );
            }
        }
    } catch (error) {
        console.error('[INCIDENT ERROR]', error);
    }
}

console.log('[INCIDENT] Service iniciado');

checkIncidents();

cron.schedule('*/15 * * * * *', () => {
    checkIncidents();
});

module.exports = {
    checkIncidents
};