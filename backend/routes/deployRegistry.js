const express = require('express');

const pool = require('../db');

const router = express.Router();

// ===============================
// LISTAR DEPLOYS
// ===============================

router.get('/', async (req, res) => {

    try {

        const result =
            await pool.query(`

                SELECT *

                FROM deploy_registry

                ORDER BY deployed_at DESC

            `);

        res.json(
            result.rows
        );

    } catch (error) {

        console.error(error);

        res.status(500).json({

            error:
                'Erro ao buscar deploys'

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

        const result =
            await pool.query(`

                INSERT INTO deploy_registry (

                    version,

                    commit_sha,

                    status,

                    smoke_test_passed,

                    notes

                )

                VALUES (

                    $1,

                    $2,

                    $3,

                    $4,

                    $5

                )

                RETURNING *

            `, [

                version,

                commit_sha,

                status,

                smoke_test_passed,

                notes

            ]);

        res.status(201).json(

            result.rows[0]

        );

    } catch (error) {

        console.error(error);

        res.status(500).json({

            error:
                'Erro ao registrar deploy'

        });

    }

});

module.exports = router;