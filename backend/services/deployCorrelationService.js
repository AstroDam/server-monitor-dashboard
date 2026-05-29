const pool = require('../db');

async function correlateIncident(incidentId, incidentTime) {
    try {
        const deployResult = await pool.query(
            `
            SELECT *
            FROM deploy_registry
            WHERE deployed_at >= $1::timestamp - INTERVAL '10 minutes'
              AND deployed_at <= $1
            ORDER BY deployed_at DESC
            LIMIT 1
            `,
            [incidentTime]
        );

        if (deployResult.rows.length === 0) {
            return;
        }

        const deploy = deployResult.rows[0];

        await pool.query(
            `
            INSERT INTO deploy_incident_correlation (
                deploy_id,
                incident_id,
                correlation_score
            )
            VALUES ($1, $2, $3)
            `,
            [
                deploy.id,
                incidentId,
                100
            ]
        );

        console.log('[DEPLOY CORRELATION]', deploy.version, '->', incidentId);
    } catch (error) {
        console.error('[DEPLOY CORRELATION ERROR]', error);
    }
}

module.exports = {
    correlateIncident
};