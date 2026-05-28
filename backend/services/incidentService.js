const cron = require('node-cron');

const pool = require('../db');

async function checkIncidents() {

    try {

        const servers =
            await pool.query(`

                SELECT *

                FROM server

            `);

        for (const server of servers.rows) {

            const heartbeatResult =
                await pool.query(`

                    SELECT received_at

                    FROM server_heartbeat

                    WHERE server_id = $1

                    ORDER BY received_at DESC

                    LIMIT 1

                `, [server.id]);

            const lastHeartbeat =
                heartbeatResult.rows[0];

            const isOnline =
                lastHeartbeat &&

                (
                    Date.now() -

                    new Date(
                        lastHeartbeat.received_at
                    ).getTime()

                ) < 30000;

            const openIncidentResult =
                await pool.query(`

                    SELECT *

                    FROM server_incident

                    WHERE server_id = $1

                    AND status = 'open'

                    LIMIT 1

                `, [server.id]);

            const openIncident =
                openIncidentResult.rows[0];

            // =========================
            // OFFLINE -> abre incidente
            // =========================

            if (!isOnline && !openIncident) {

                await pool.query(`

                    INSERT INTO server_incident (

                        server_id,
                        status,
                        reason

                    )

                    VALUES ($1,$2,$3)

                `, [

                    server.id,
                    'open',
                    'heartbeat_timeout'

                ]);

                console.log(
                    `[INCIDENT] Aberto para ${server.hostname}`
                );

            }

            // =========================
            // ONLINE -> resolve incidente
            // =========================

            if (isOnline && openIncident) {

                const startedAt =
                    new Date(
                        openIncident.started_at
                    );

                const durationSeconds =
                    Math.floor(

                        (
                            Date.now() -
                            startedAt.getTime()
                        ) / 1000

                    );

                await pool.query(`

                    UPDATE server_incident

                    SET

                        status = 'resolved',

                        resolved_at = NOW(),

                        duration_seconds = $1

                    WHERE id = $2

                `, [

                    durationSeconds,
                    openIncident.id

                ]);

                console.log(
                    `[INCIDENT] Resolvido para ${server.hostname}`
                );

            }

        }

    } catch (error) {

        console.error(
            '[INCIDENT ERROR]',
            error
        );

    }

}

cron.schedule('*/15 * * * * *', () => {

    checkIncidents();

});

module.exports = {
    checkIncidents
};