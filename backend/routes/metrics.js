const express = require('express');
const crypto = require('crypto');

const pool = require('../db');
const authMiddleware = require('../middlewares/auth');
const createLog = require('../utils/logger');

const {
    sendTelegramAlert
} = require('../services/telegramService');

const router = express.Router();

function adminOnly(req, res, next) {

    if (!req.user || req.user.role !== 'admin') {

        return res.status(403).json({
            error: 'Acesso negado'
        });

    }

    next();

}

function compareMetric(value, operator, threshold) {

    switch (operator) {

        case '>':
            return value > threshold;

        case '<':
            return value < threshold;

        case '>=':
            return value >= threshold;

        case '<=':
            return value <= threshold;

        case '=':
        case '==':
            return value === threshold;

        default:
            return false;

    }

}

async function evaluateAlertRules(serverId, hostname, metrics) {

    try {

        const rulesResult =
            await pool.query(`

                SELECT *

                FROM alert_rule

                WHERE enabled = true

                AND (

                    server_id IS NULL

                    OR server_id = $1

                )

            `, [serverId]);

        for (const rule of rulesResult.rows) {

            const metric =
                metrics.find(

                    item =>

                        item.metric_name ===
                        rule.metric_name

                );

            if (!metric) continue;

            const triggered =
                compareMetric(

                    Number(metric.value),

                    rule.operator,

                    Number(rule.threshold)

                );

            const openAlertResult =
                await pool.query(`

                    SELECT id

                    FROM alert

                    WHERE rule_id = $1

                    AND server_id = $2

                    AND status = 'open'

                    LIMIT 1

                `, [

                    rule.id,
                    serverId

                ]);

            const hasOpenAlert =
                openAlertResult.rows.length > 0;

            if (triggered && !hasOpenAlert) {

                const alertResult =
                    await pool.query(`

                        INSERT INTO alert (

                            rule_id,
                            server_id,
                            metric_name,
                            value,
                            status

                        )

                        VALUES ($1,$2,$3,$4,$5)

                        RETURNING *

                    `, [

                        rule.id,
                        serverId,
                        rule.metric_name,
                        metric.value,
                        'open'

                    ]);

                const alert =
                    alertResult.rows[0];

                await createLog({

                    server_id: serverId,

                    level: 'WARN',

                    message:
                        `Alerta disparado: ${rule.name} em ${hostname}. Valor: ${metric.value}${metric.unit || ''}`

                });

                await sendTelegramAlert({

                    title:
                        `Alerta disparado: ${rule.name}`,

                    server:
                        hostname,

                    metric:
                        rule.metric_name,

                    value:
                        `${metric.value}${metric.unit || ''}`,

                    severity:
                        'critical'

                });

                if (global.io) {

                    global.io.emit(
                        'new-alert',
                        alert
                    );

                }

            }

            if (!triggered && hasOpenAlert) {

                await pool.query(`

                    UPDATE alert

                    SET

                        status = 'resolved',

                        resolved_at = NOW()

                    WHERE rule_id = $1

                    AND server_id = $2

                    AND status = 'open'

                `, [

                    rule.id,
                    serverId

                ]);

                await createLog({

                    server_id: serverId,

                    level: 'INFO',

                    message:
                        `Alerta resolvido: ${rule.name} em ${hostname}`

                });

            }

        }

    } catch (error) {

        console.error(
            'Erro ao avaliar regras:',
            error
        );

    }

}

// ===============================
// SERVERS
// ===============================

router.get('/servers', authMiddleware, async (req, res) => {

    try {

        const result =
            await pool.query(`

                WITH heartbeat_stats AS (

                    SELECT

                        server_id,

                        MAX(received_at) AS last_heartbeat_at

                    FROM server_heartbeat

                    GROUP BY server_id

                )

                SELECT

                    s.*,

                    hs.last_heartbeat_at,

                    CASE

                        WHEN hs.last_heartbeat_at >= NOW() - INTERVAL '30 seconds'

                        THEN true

                        ELSE false

                    END AS online

                FROM server s

                LEFT JOIN heartbeat_stats hs

                ON hs.server_id = s.id

                ORDER BY s.created_at ASC

            `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar servidores'
        });

    }

});

// ===============================
// CREATE SERVER
// ===============================

router.post('/servers', authMiddleware, adminOnly, async (req, res) => {

    try {

        const {
            name,
            hostname,
            ip_address,
            platform
        } = req.body;

        const agentToken =
            crypto.randomBytes(32).toString('hex');

        const result =
            await pool.query(`

                INSERT INTO server (

                    name,
                    hostname,
                    ip_address,
                    platform,
                    agent_token

                )

                VALUES ($1,$2,$3,$4,$5)

                RETURNING *

            `, [

                name,
                hostname,
                ip_address,
                platform || 'Linux',
                agentToken

            ]);

        res.status(201).json(
            result.rows[0]
        );

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Erro ao criar servidor'
        });

    }

});

// ===============================
// INGEST
// ===============================

router.post('/ingest', async (req, res) => {

    try {

        const token =
            req.headers.authorization
                ?.replace('Bearer ', '');

        if (!token) {

            return res.status(401).json({
                error: 'Token do agent não enviado'
            });

        }

        const serverResult =
            await pool.query(`

                SELECT *

                FROM server

                WHERE agent_token = $1

                LIMIT 1

            `, [token]);

        if (serverResult.rows.length === 0) {

            return res.status(401).json({
                error: 'Token do agent inválido'
            });

        }

        const server =
            serverResult.rows[0];

        const {

            hostname,
            platform,
            ip_address,

            cpu,
            memory,
            disk,

            uptime_seconds,
            process_count,

            top_cpu_process,
            top_memory_process,

            network_rx_sec,
            network_tx_sec

        } = req.body;

        await pool.query(`

            UPDATE server

            SET

                hostname = COALESCE($1, hostname),

                platform = COALESCE($2, platform),

                ip_address = COALESCE($3, ip_address)

            WHERE id = $4

        `, [

            hostname,
            platform,
            ip_address,
            server.id

        ]);

        const metrics = [

            {
                metric_name: 'cpu_usage',
                value: cpu,
                unit: '%'
            },

            {
                metric_name: 'memory_usage',
                value: memory,
                unit: '%'
            },

            {
                metric_name: 'disk_usage',
                value: disk,
                unit: '%'
            },

            {
                metric_name: 'system_uptime_seconds',
                value: uptime_seconds,
                unit: 's'
            },

            {
                metric_name: 'process_count',
                value: process_count,
                unit: 'processes'
            },

            {
                metric_name: 'network_rx_sec',
                value: network_rx_sec,
                unit: 'B/s'
            },

            {
                metric_name: 'network_tx_sec',
                value: network_tx_sec,
                unit: 'B/s'
            }

        ].filter(metric =>

            metric.value !== undefined &&
            metric.value !== null

        );

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

                server.id,
                metric.metric_name,
                metric.value,
                metric.unit

            ]);

        }

        if (top_cpu_process || top_memory_process) {

            await createLog({

                server_id: server.id,

                level: 'INFO',

                message:
                    `Processos: CPU=${top_cpu_process || '-'} | MEM=${top_memory_process || '-'}`

            });

        }

        await evaluateAlertRules(

            server.id,

            hostname || server.hostname,

            metrics

        );

        if (global.io) {

            global.io.emit('metrics-update', {

                server_id: server.id,

                hostname:
                    hostname || server.hostname,

                cpu,
                memory,
                disk,

                uptime_seconds,
                process_count,

                network_rx_sec,
                network_tx_sec,

                top_cpu_process,
                top_memory_process

            });

        }

        res.json({
            success: true
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Erro ao receber métricas do agent'
        });

    }

});

// ===============================
// HEARTBEAT
// ===============================

router.post('/heartbeat', async (req, res) => {

    try {

        const token =
            req.headers.authorization
                ?.replace('Bearer ', '');

        if (!token) {

            return res.status(401).json({
                error: 'Token do agent não enviado'
            });

        }

        const serverResult =
            await pool.query(`

                SELECT *

                FROM server

                WHERE agent_token = $1

                LIMIT 1

            `, [token]);

        if (serverResult.rows.length === 0) {

            return res.status(401).json({
                error: 'Token inválido'
            });

        }

        const server =
            serverResult.rows[0];

        await pool.query(`

            INSERT INTO server_heartbeat (

                server_id

            )

            VALUES ($1)

        `, [server.id]);

        res.json({
            success: true
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Erro heartbeat'
        });

    }

});

module.exports = router;