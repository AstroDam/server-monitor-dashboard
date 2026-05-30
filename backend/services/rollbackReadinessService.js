const pool = require('../db');

async function evaluateRollbackReadiness(deployId) {
    try {
        const deployResult = await pool.query(
            `
            SELECT *
            FROM deploy_registry
            WHERE id = $1
            LIMIT 1
            `,
            [deployId]
        );

        if (deployResult.rows.length === 0) {
            return;
        }

        const deploy = deployResult.rows[0];

        const shouldRollback =
            deploy.risk_level === 'HIGH' ||
            Number(deploy.risk_score || 0) >= 75;

        if (!shouldRollback) {
            await pool.query(
                `
                UPDATE deploy_registry
                SET rollback_recommended = false,
                    rollback_reason = NULL
                WHERE id = $1
                `,
                [deployId]
            );

            return;
        }

        await pool.query(
            `
            UPDATE deploy_registry
            SET rollback_recommended = true,
                rollback_reason = $1
            WHERE id = $2
            `,
            [
                `Deploy marcado como risco ${deploy.risk_level} com score ${deploy.risk_score}`,
                deployId
            ]
        );

        console.log(
            '[ROLLBACK READINESS]',
            deploy.version,
            'rollback recommended'
        );
    } catch (error) {
        console.error('[ROLLBACK READINESS ERROR]', error);
    }
}

module.exports = {
    evaluateRollbackReadiness
};