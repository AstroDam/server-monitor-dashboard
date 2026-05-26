const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

const VALID_ROLES = ['admin', 'operator', 'viewer'];

function adminOnly(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Acesso negado. Apenas administradores podem gerenciar usuários.'
        });
    }

    next();
}

router.use(authMiddleware);
router.use(adminOnly);

async function countAdmins() {
    const result = await pool.query(
        `SELECT COUNT(*)::int AS total FROM user_account WHERE role = 'admin'`
    );

    return result.rows[0].total;
}

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
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// CRIAR USUÁRIO
router.post('/', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Usuário e senha são obrigatórios'
            });
        }

        const normalizedUsername = username.trim().toLowerCase();
        const normalizedEmail = email ? email.trim().toLowerCase() : null;
        const selectedRole = role || 'viewer';

        if (!normalizedUsername) {
            return res.status(400).json({
                error: 'Usuário inválido'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'A senha precisa ter pelo menos 6 caracteres'
            });
        }

        if (!VALID_ROLES.includes(selectedRole)) {
            return res.status(400).json({
                error: 'Perfil inválido'
            });
        }

        const exists = await pool.query(
            `
            SELECT id
            FROM user_account
            WHERE LOWER(username) = $1
               OR ($2::text IS NOT NULL AND LOWER(email) = $2)
            LIMIT 1
            `,
            [normalizedUsername, normalizedEmail]
        );

        if (exists.rows.length > 0) {
            return res.status(409).json({
                error: 'Usuário ou e-mail já cadastrado'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `
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
            `,
            [
                normalizedUsername,
                normalizedEmail,
                passwordHash,
                selectedRole
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// ALTERAR PERFIL
router.put('/:id/role', async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({
                error: 'Perfil inválido'
            });
        }

        if (id === req.user.id) {
            return res.status(400).json({
                error: 'Você não pode alterar seu próprio perfil'
            });
        }

        const userResult = await pool.query(
            `
            SELECT id, role
            FROM user_account
            WHERE id = $1
            LIMIT 1
            `,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuário não encontrado'
            });
        }

        const targetUser = userResult.rows[0];

        if (targetUser.role === 'admin' && role !== 'admin') {
            const adminTotal = await countAdmins();

            if (adminTotal <= 1) {
                return res.status(400).json({
                    error: 'Não é possível remover o último administrador'
                });
            }
        }

        const result = await pool.query(
            `
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
            `,
            [role, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao alterar perfil:', error);
        res.status(500).json({ error: 'Erro ao alterar perfil' });
    }
});

// REMOVER USUÁRIO
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({
                error: 'Você não pode remover seu próprio usuário'
            });
        }

        const userResult = await pool.query(
            `
            SELECT id, role
            FROM user_account
            WHERE id = $1
            LIMIT 1
            `,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Usuário não encontrado'
            });
        }

        const targetUser = userResult.rows[0];

        if (targetUser.role === 'admin') {
            const adminTotal = await countAdmins();

            if (adminTotal <= 1) {
                return res.status(400).json({
                    error: 'Não é possível remover o último administrador'
                });
            }
        }

        await pool.query(
            `DELETE FROM user_account WHERE id = $1`,
            [id]
        );

        res.json({
            success: true,
            message: 'Usuário removido com sucesso'
        });
    } catch (error) {
        console.error('Erro ao remover usuário:', error);
        res.status(500).json({ error: 'Erro ao remover usuário' });
    }
});

module.exports = router;