const pool = require('../db');

const {
    evaluateRollbackReadiness
} = require('./rollbackReadinessService');

async function updateDeployRisk(deployId) {

    try {

        const correlationResult =
            await pool.query(`

                SELECT COUNT(*)::INTEGER AS total

                FROM deploy_incident_correlation

                WHERE deploy_id = $1

            `, [deployId]);

        const total =
            correlationResult.rows[0].total;

        let riskScore =
            total * 25;

        if (riskScore > 100) {
            riskScore = 100;
        }

        let riskLevel =
            'LOW';

        if (riskScore >= 50) {
            riskLevel = 'MEDIUM';
        }

        if (riskScore >= 75) {
            riskLevel = 'HIGH';
        }

        await pool.query(`

            UPDATE deploy_registry

            SET

                risk_score = $1,

                risk_level = $2

            WHERE id = $3

        `, [

            riskScore,
            riskLevel,
            deployId

        ]);

        await evaluateRollbackReadiness(
            deployId
        );

        console.log(

            '[DEPLOY RISK]',

            deployId,

            riskLevel,

            riskScore

        );

    } catch (error) {

        console.error(
            '[DEPLOY RISK ERROR]',
            error
        );

    }

}

module.exports = {
    updateDeployRisk
};