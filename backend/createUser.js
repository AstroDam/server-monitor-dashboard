const bcrypt = require('bcrypt');

const pool = require('./db');

async function createUser() {

    const passwordHash =
        await bcrypt.hash(
            'admin123',
            10
        );

    await pool.query(`

        INSERT INTO user_account (

            username,

            email,

            password_hash,

            role

        )

        VALUES ($1,$2,$3,$4)

    `, [

        'admin',

        'admin@email.com',

        passwordHash,

        'admin'

    ]);

    console.log(
        'Usuário criado'
    );

    process.exit();

}

createUser();