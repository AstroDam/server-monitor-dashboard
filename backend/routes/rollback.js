const express = require('express');

const pool = require('../db');

const router = express.Router();

// ===============================
// ROLLBACK STATUS
// ===============================

router.get('/status', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) FILTER (
                    WHERE rollback_recommended = true
                ) AS pending_recommendations,

                COUNT(*) FILTER (
                    WHERE status = 'rollback_success'
                ) AS successful_rollbacks,

                COUNT(*) FILTER (
                    WHERE status = 'rollback_failed'
                ) AS failed_rollbacks
            FROM deploy_registry
        `);

        res.json({
            rollback_enabled: false,
            execution_mode: 'manual',
            message: 'Rollback execution is manual via scripts/rollback.sh',
            ...result.rows[0]
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar status de rollback'
        });
    }
});

// ===============================
// ROLLBACK RECOMMENDATIONS
// ===============================

router.get('/recommendations', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                version,
                commit_sha,
                status,
                deployed_at,
                risk_score,
                risk_level,
                rollback_recommended,
                rollback_reason
            FROM deploy_registry
            WHERE rollback_recommended = true
            ORDER BY deployed_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar recomendações de rollback'
        });
    }
});

module.exports = router;