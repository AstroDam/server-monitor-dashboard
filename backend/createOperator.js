const bcrypt = require('bcrypt');

const pool = require('./db');

async function createOperator() {

    const passwordHash =
        await bcrypt.hash(
            '123456',
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
        'operator',
        'operator@email.com',
        passwordHash,
        'operator'
    ]);

    console.log('Operator criado');

    process.exit();

}

createOperator();