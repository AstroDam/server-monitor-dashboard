const express = require('express');

const bcrypt = require('bcrypt');

const jwt = require('jsonwebtoken');

const pool = require('../db');

const router = express.Router();

const SECRET =
    'monitor-secret-key';

// LOGIN

router.post('/login', async (req, res) => {

    try {

        const {

            username,

            password

        } = req.body;

        const result =
            await pool.query(

                `

                SELECT *

                FROM user_account

                WHERE username = $1

                `,

                [username]

            );

        if (
            result.rows.length === 0
        ) {

            return res.status(401)
                .json({

                    error:
                        'Usuário inválido'

                });

        }

        const user =
            result.rows[0];

        const validPassword =
            await bcrypt.compare(

                password,

                user.password_hash

            );

        if (!validPassword) {

            return res.status(401)
                .json({

                    error:
                        'Senha inválida'

                });

        }

        const token =
            jwt.sign(

                {

                    id: user.id,

                    role: user.role

                },

                SECRET,

                {

                    expiresIn: '12h'

                }

            );

        res.json({

            token,

            username:
                user.username,

            role:
                user.role

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            error:
                'Erro no login'

        });

    }

});

module.exports = router;