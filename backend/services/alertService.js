const pool = require('../db');

const {
    sendTelegramAlert
} = require('./telegramService');

async function checkAlerts(metrics, serverId) {

    try {

        const rules =
            await pool.query(`

                SELECT *

                FROM alert_rule

                WHERE enabled = true

            `);

        for (const rule of rules.rows) {

            const metric =
                metrics.find(

                    m =>

                    m.metric_name ===
                    rule.metric_name

                );

            if (!metric) continue;

            let triggered = false;

            switch (rule.operator) {

                case '>':

                    triggered =
                        metric.value >
                        rule.threshold;

                    break;

                case '<':

                    triggered =
                        metric.value <
                        rule.threshold;

                    break;

                case '>=':

                    triggered =
                        metric.value >=
                        rule.threshold;

                    break;

                case '<=':

                    triggered =
                        metric.value <=
                        rule.threshold;

                    break;

            }

            if (triggered) {

                // evita alertas duplicados abertos

                const existingAlert =
                    await pool.query(`

                        SELECT id

                        FROM alert

                        WHERE rule_id = $1
                        AND status = 'open'

                        LIMIT 1

                    `, [

                        rule.id

                    ]);

                if (
                    existingAlert.rows.length > 0
                ) {

                    continue;

                }

                await pool.query(`

                    INSERT INTO alert (

                        rule_id,

                        server_id,

                        metric_name,

                        value,

                        status

                    )

                    VALUES ($1,$2,$3,$4,$5)

                `, [

                    rule.id,

                    serverId,

                    metric.metric_name,

                    metric.value,

                    'open'

                ]);

                console.log(

                    'ALERTA GERADO:',

                    metric.metric_name,

                    metric.value

                );

                // TELEGRAM

                await sendTelegramAlert({

                    title:
                        `Alerta de ${metric.metric_name}`,

                    server:
                        `Servidor ${serverId}`,

                    metric:
                        metric.metric_name,

                    value:
                        `${metric.value}${metric.unit}`,

                    severity:
                        'critical'

                });

            }

        }

    } catch (error) {

        console.error(error);

    }

}

module.exports = checkAlerts;