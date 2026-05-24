const si = require('systeminformation');

const cron = require('node-cron');

const pool = require('../db');

const checkAlerts =
    require('./alertService');

async function collectMetrics() {

    try {

        // Busca servidor

        const serverResult =
            await pool.query(`

                SELECT id

                FROM server

                LIMIT 1

            `);

        if (
            serverResult.rows.length === 0
        ) {

            console.log(
                'Nenhum servidor encontrado'
            );

            return;

        }

        const serverId =
            serverResult.rows[0].id;

        // Coleta métricas

        const cpu =
            await si.currentLoad();

        const memory =
            await si.mem();

        const disk =
            await si.fsSize();

        // Valores formatados

        const cpuUsage =
            Number(
                cpu.currentLoad.toFixed(2)
            );

        const memoryUsage =
            Number(

                (

                    (
                        memory.used /
                        memory.total

                    ) * 100

                ).toFixed(2)

            );

        const diskUsage =
            Number(
                disk[0].use.toFixed(2)
            );

        // Array de métricas

        const metrics = [

            {

                metric_name:
                    'cpu_usage',

                value:
                    cpuUsage,

                unit:
                    '%'

            },

            {

                metric_name:
                    'memory_usage',

                value:
                    memoryUsage,

                unit:
                    '%'

            },

            {

                metric_name:
                    'disk_usage',

                value:
                    diskUsage,

                unit:
                    '%'

            }

        ];

        // Salva no banco

        for (const metric of metrics) {

            await pool.query(`

                INSERT INTO metric_sample (

                    server_id,

                    metric_name,

                    value,

                    unit

                )

                VALUES ($1,$2,$3,$4)

            `, [

                serverId,

                metric.metric_name,

                metric.value,

                metric.unit

            ]);

        }

        // Verifica alertas

        await checkAlerts(
            metrics,
            serverId
        );

        // REALTIME SOCKET.IO

        const realtimeMetrics = {

            cpu:
                cpuUsage,

            memory:
                memoryUsage,

            disk:
                diskUsage

        };

        if (global.io) {

            global.io.emit(

                'metrics-update',

                realtimeMetrics

            );

        }

        console.log(

            'Métricas salvas:',
            realtimeMetrics

        );

    } catch (error) {

        console.error(
            'Erro ao coletar métricas:',
            error
        );

    }

}

// Coleta a cada 5 segundos

cron.schedule('*/5 * * * * *', () => {

    collectMetrics();

});

module.exports = collectMetrics;