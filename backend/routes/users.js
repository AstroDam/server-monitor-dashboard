const express = require('express');

const bcrypt = require('bcrypt');

const pool = require('../db');

const authMiddleware =
    require('../middlewares/auth');

const router = express.Router();

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Acesso negado'
        });
    }

    next();
}

router.use(authMiddleware);
router.use(adminOnly);

// LISTAR USUÁRIOS

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                username,
                email,
                role,
                created_at,
                last_login
            FROM user_account
            ORDER BY created_at DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao listar usuários'
        });
    }
});

// CRIAR USUÁRIO

router.post('/', async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            role
        } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({
                error: 'Usuário, senha e perfil são obrigatórios'
            });
        }

        const normalizedUsername =
            username.trim().toLowerCase();

        const validRoles = [
            'admin',
            'operator',
            'viewer'
        ];

        if (!validRoles.includes(role)) {
            return res.status(400).json({
                error: 'Perfil inválido'
            });
        }

        const exists = await pool.query(`
            SELECT id
            FROM user_account
            WHERE LOWER(username) = $1
            LIMIT 1
        `, [
            normalizedUsername
        ]);

        if (exists.rows.length > 0) {
            return res.status(409).json({
                error: 'Usuário já existe'
            });
        }

        const passwordHash =
            await bcrypt.hash(password, 10);

        const result = await pool.query(`
            INSERT INTO user_account (
                username,
                email,
                password_hash,
                role
            )
            VALUES ($1, $2, $3, $4)
            RETURNING
                id,
                username,
                email,
                role,
                created_at,
                last_login
        `, [
            normalizedUsername,
            email || null,
            passwordHash,
            role
        ]);

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao criar usuário'
        });
    }
});

// ALTERAR PERFIL

router.put('/:id/role', async (req, res) => {
    try {
        const {
            id
        } = req.params;

        const {
            role
        } = req.body;

        const validRoles = [
            'admin',
            'operator',
            'viewer'
        ];

        if (!validRoles.includes(role)) {
            return res.status(400).json({
                error: 'Perfil inválido'
            });
        }

        if (id === req.user.id) {
            return res.status(400).json({
                error: 'Você não pode alterar seu próprio perfil'
            });
        }

        const result = await pool.query(`
            UPDATE user_account
            SET role = $1
            WHERE id = $2
            RETURNING
                id,
                username,
                email,
                role,
                created_at,
                last_login
        `, [
            role,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuário não encontrado'
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao alterar perfil'
        });
    }
});

// REMOVER USUÁRIO

router.delete('/:id', async (req, res) => {
    try {
        const {
            id
        } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({
                error: 'Você não pode remover seu próprio usuário'
            });
        }

        const result = await pool.query(`
            DELETE FROM user_account
            WHERE id = $1
            RETURNING id
        `, [
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuário não encontrado'
            });
        }

        res.json({
            success: true
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao remover usuário'
        });
    }
});

module.exports = router;