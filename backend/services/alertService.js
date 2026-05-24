const pool = require('../db');

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

            }

            if (triggered) {

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

            }

        }

    } catch (error) {

        console.error(error);

    }

}

module.exports = checkAlerts;