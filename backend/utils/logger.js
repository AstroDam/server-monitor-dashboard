const pool = require('../db');

async function createLog({

    server_id = null,

    level = 'INFO',

    message

}) {

    try {

        const result =
            await pool.query(`

                INSERT INTO system_log (

                    server_id,
                    level,
                    message

                )

                VALUES ($1,$2,$3)

                RETURNING *

            `, [

                server_id,
                level,
                message

            ]);

        const log =
            result.rows[0];

        if (global.io) {

            global.io.emit(
                'new-log',
                log
            );

        }

    } catch (error) {

        console.error(
            'Erro logger:',
            error
        );

    }

}

module.exports = createLog;