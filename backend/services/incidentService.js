const express = require('express');

const pool = require('../db');

const router = express.Router();

// ===============================
// LISTAR DEPLOYS
// ===============================

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM deploy_registry
            ORDER BY deployed_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar deploys'
        });
    }
});

// ===============================
// REGISTRAR DEPLOY
// ===============================

router.post('/', async (req, res) => {
    try {
        const {
            version,
            commit_sha,
            status,
            smoke_test_passed,
            notes
        } = req.body;

        const result = await pool.query(`
            INSERT INTO deploy_registry (
                version,
                commit_sha,
                status,
                smoke_test_passed,
                notes
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [
            version,
            commit_sha,
            status,
            smoke_test_passed,
            notes
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao registrar deploy'
        });
    }
});

// ===============================
// DEPLOY CORRELATIONS
// ===============================

router.get('/correlations', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                c.id AS correlation_id,
                c.correlation_score,
                c.created_at AS correlated_at,

                d.id AS deploy_id,
                d.version,
                d.commit_sha,
                d.status AS deploy_status,
                d.smoke_test_passed,
                d.deployed_at,

                i.id AS incident_id,
                i.server_id,
                i.status AS incident_status,
                i.reason,
                i.started_at,
                i.resolved_at,
                i.duration_seconds,

                s.name AS server_name,
                s.hostname,
                s.ip_address

            FROM deploy_incident_correlation c

            JOIN deploy_registry d
                ON d.id = c.deploy_id

            JOIN server_incident i
                ON i.id = c.incident_id

            LEFT JOIN server s
                ON s.id = i.server_id

            ORDER BY i.started_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar correlações'
        });
    }
});

module.exports = router;