const express = require('express');
const crypto = require('crypto');

const authMiddleware = require('../middlewares/auth');
const createLog = require('../utils/logger');

const {
    sendTelegramAlert
} = require('../services/telegramService');

const router = express.Router();

function getInterval(period) {
    const allowed = {
        '15m': '15 minutes',
        '1h': '1 hour',
        '6h': '6 hours',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
    };

    return allowed[period] || '15 minutes';
}

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
        const rulesResult = await pool.query(
            `
            SELECT *
            FROM alert_rule
            WHERE enabled = true
              AND (
                    server_id IS NULL
                    OR server_id = $1
                  )
            `,
            [serverId]
        );

        for (const rule of rulesResult.rows) {
            const metric = metrics.find(item =>
                item.metric_name === rule.metric_name
            );

            if (!metric) continue;

            const triggered = compareMetric(
                Number(metric.value),
                rule.operator,
                Number(rule.threshold)
            );

            const openAlertResult = await pool.query(
                `
                SELECT id
                FROM alert
                WHERE rule_id = $1
                  AND server_id = $2
                  AND status = 'open'
                LIMIT 1
                `,
                [rule.id, serverId]
            );

            const hasOpenAlert =
                openAlertResult.rows.length > 0;

            if (triggered && !hasOpenAlert) {
                const alertResult = await pool.query(
                    `
                    INSERT INTO alert (
                        rule_id,
                        server_id,
                        metric_name,
                        value,
                        status
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                    `,
                    [
                        rule.id,
                        serverId,
                        rule.metric_name,
                        metric.value,
                        'open'
                    ]
                );

                const alert = alertResult.rows[0];

                await createLog({
                    server_id: serverId,
                    level: 'WARN',
                    message: `Alerta disparado: ${rule.name} em ${hostname}. Valor: ${metric.value}${metric.unit || ''}`
                });

                await sendTelegramAlert({
                    title: `Alerta disparado: ${rule.name}`,
                    server: hostname,
                    metric: rule.metric_name,
                    value: `${metric.value}${metric.unit || ''}`,
                    severity: 'critical'
                });

                if (global.io) {
                    global.io.emit('new-alert', alert);
                }
            }

            if (!triggered && hasOpenAlert) {
                await pool.query(
                    `
                    UPDATE alert
                    SET status = 'resolved',
                        resolved_at = NOW()
                    WHERE rule_id = $1
                      AND server_id = $2
                      AND status = 'open'
                    `,
                    [rule.id, serverId]
                );

                await createLog({
                    server_id: serverId,
                    level: 'INFO',
                    message: `Alerta resolvido: ${rule.name} em ${hostname}`
                });
            }
        }
    } catch (error) {
        console.error('Erro ao avaliar regras:', error);
    }
}

router.get('/latest', authMiddleware, async (req, res) => {
    try {
        const serverId = req.query.server_id;

        const params = [];
        let serverFilter = '';

        if (serverId && serverId !== 'all') {
            params.push(serverId);
            serverFilter = `AND server_id = $${params.length}`;
        }

        const cpuResult = await pool.query(
            `
            SELECT value
            FROM metric_sample
            WHERE metric_name = 'cpu_usage'
            ${serverFilter}
            ORDER BY collected_at DESC
            LIMIT 1
            `,
            params
        );

        const memoryResult = await pool.query(
            `
            SELECT value
            FROM metric_sample
            WHERE metric_name = 'memory_usage'
            ${serverFilter}
            ORDER BY collected_at DESC
            LIMIT 1
            `,
            params
        );

        const diskResult = await pool.query(
            `
            SELECT value
            FROM metric_sample
            WHERE metric_name = 'disk_usage'
            ${serverFilter}
            ORDER BY collected_at DESC
            LIMIT 1
            `,
            params
        );

        let hostname = 'Todos';
        let platform = 'Linux';

        if (serverId && serverId !== 'all') {
            const serverResult = await pool.query(
                `
                SELECT hostname, name, platform
                FROM server
                WHERE id = $1
                LIMIT 1
                `,
                [serverId]
            );

            hostname =
                serverResult.rows[0]?.hostname ||
                serverResult.rows[0]?.name ||
                'Servidor';

            platform =
                serverResult.rows[0]?.platform ||
                'Linux';
        }

        res.json({
            cpu_usage: cpuResult.rows[0]?.value || 0,
            memory_usage: memoryResult.rows[0]?.value || 0,
            disk_usage: diskResult.rows[0]?.value || 0,
            hostname,
            platform
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar métricas'
        });
    }
});

router.get('/history', authMiddleware, async (req, res) => {
    try {
        const {
            period,
            start,
            end,
            server_id
        } = req.query;

        const params = [];
        const conditions = [
            `metric_name IN ('cpu_usage', 'memory_usage')`
        ];

        if (server_id && server_id !== 'all') {
            params.push(server_id);
            conditions.push(`server_id = $${params.length}`);
        }

        if (start && end) {
            params.push(start);
            conditions.push(`collected_at >= $${params.length}`);

            params.push(end);
            conditions.push(`collected_at <= $${params.length}`);
        } else {
            const interval = getInterval(period || '15m');

            params.push(interval);
            conditions.push(
                `collected_at >= NOW() - ($${params.length}::interval)`
            );
        }

        const result = await pool.query(
            `
            SELECT metric_name, value, collected_at
            FROM metric_sample
            WHERE ${conditions.join(' AND ')}
            ORDER BY collected_at ASC
            `,
            params
        );

        const grouped = {};

        result.rows.forEach(row => {
            const time =
                new Date(row.collected_at).toLocaleString();

            if (!grouped[time]) {
                grouped[time] = {
                    cpu: null,
                    memory: null
                };
            }

            if (row.metric_name === 'cpu_usage') {
                grouped[time].cpu = row.value;
            }

            if (row.metric_name === 'memory_usage') {
                grouped[time].memory = row.value;
            }
        });

        const labels = Object.keys(grouped);

        res.json({
            labels,
            cpu: labels.map(label => grouped[label].cpu),
            memory: labels.map(label => grouped[label].memory)
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar histórico'
        });
    }
});

router.get('/alerts', authMiddleware, async (req, res) => {
    try {
        const serverId = req.query.server_id;

        const params = [];
        let filter = '';

        if (serverId && serverId !== 'all') {
            params.push(serverId);
            filter = `WHERE a.server_id = $1`;
        }

        const result = await pool.query(
            `
            SELECT
                a.*,
                s.name AS server_name
            FROM alert a
            LEFT JOIN server s ON s.id = a.server_id
            ${filter}
            ORDER BY a.raised_at DESC
            LIMIT 20
            `,
            params
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar alertas'
        });
    }
});

router.get('/logs', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                sl.*,
                s.name AS server_name
            FROM system_log sl
            LEFT JOIN server s ON s.id = sl.server_id
            ORDER BY sl.created_at DESC
            LIMIT 100
            `
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar logs'
        });
    }
});

router.get('/servers', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `
            WITH heartbeat_stats AS (
                SELECT
                    server_id,
                    MAX(received_at) AS last_heartbeat_at,
                    COUNT(*) AS heartbeat_count
                FROM server_heartbeat
                GROUP BY server_id
            ),
            metric_stats AS (
                SELECT
                    server_id,
                    MAX(collected_at) AS last_metric_at
                FROM metric_sample
                GROUP BY server_id
            )
            SELECT
                s.*,
                hs.last_heartbeat_at,
                ms.last_metric_at,
                GREATEST(
                    hs.last_heartbeat_at,
                    ms.last_metric_at
                ) AS last_seen,
                CASE
                    WHEN hs.last_heartbeat_at >= NOW() - INTERVAL '30 seconds'
                    THEN true
                    ELSE false
                END AS online,
                COALESCE(
                    ROUND(
                        (
                            hs.heartbeat_count::decimal
                            /
                            GREATEST(
                                EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 5,
                                1
                            )
                        ) * 100,
                        2
                    ),
                    0
                ) AS availability_percent,
                COALESCE(
                    ROUND(
                        (
                            hs.heartbeat_count::decimal
                            /
                            GREATEST(
                                EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 5,
                                1
                            )
                        ) * 100,
                        2
                    ),
                    0
                ) AS uptime_percent
            FROM server s
            LEFT JOIN heartbeat_stats hs ON hs.server_id = s.id
            LEFT JOIN metric_stats ms ON ms.server_id = s.id
            ORDER BY s.created_at ASC
            `
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar servidores'
        });
    }
});

router.post('/servers', authMiddleware, adminOnly, async (req, res) => {
    try {
        const {
            name,
            hostname,
            ip_address,
            platform
        } = req.body;

        if (!name || !hostname) {
            return res.status(400).json({
                error: 'Nome e hostname obrigatórios'
            });
        }

        const normalizedHostname =
            hostname.trim().toLowerCase();

        const exists = await pool.query(
            `
            SELECT id
            FROM server
            WHERE LOWER(hostname) = $1
            LIMIT 1
            `,
            [normalizedHostname]
        );

        if (exists.rows.length > 0) {
            return res.status(409).json({
                error: 'Servidor já cadastrado'
            });
        }

        const agentToken =
            crypto.randomBytes(32).toString('hex');

        const result = await pool.query(
            `
            INSERT INTO server (
                name,
                hostname,
                ip_address,
                platform,
                agent_token
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [
                name.trim(),
                normalizedHostname,
                ip_address || null,
                platform || 'Linux',
                agentToken
            ]
        );

        await createLog({
            level: 'INFO',
            message: `Servidor cadastrado: ${name}`
        });

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao cadastrar servidor'
        });
    }
});

router.delete('/servers/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(`DELETE FROM alert WHERE server_id = $1`, [id]);
        await pool.query(`DELETE FROM metric_sample WHERE server_id = $1`, [id]);
        await pool.query(`DELETE FROM server_heartbeat WHERE server_id = $1`, [id]);
        await pool.query(`DELETE FROM alert_rule WHERE server_id = $1`, [id]);
        await pool.query(`DELETE FROM server WHERE id = $1`, [id]);

        await createLog({
            level: 'WARN',
            message: 'Servidor removido'
        });

        res.json({
            success: true
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao remover servidor'
        });
    }
});

router.post('/servers/:id/regenerate-token', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        const newToken =
            crypto.randomBytes(32).toString('hex');

        const result = await pool.query(
            `
            UPDATE server
            SET agent_token = $1
            WHERE id = $2
            RETURNING *
            `,
            [newToken, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Servidor não encontrado'
            });
        }

        await createLog({
            level: 'INFO',
            message: 'Token de servidor regenerado'
        });

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao regenerar token'
        });
    }
});

router.post('/ingest', async (req, res) => {
    try {
        const token =
            req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                error: 'Token do agent não enviado'
            });
        }

        const serverResult = await pool.query(
            `
            SELECT *
            FROM server
            WHERE agent_token = $1
            LIMIT 1
            `,
            [token]
        );

        if (serverResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Token do agent inválido'
            });
        }

        const server = serverResult.rows[0];

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

        await pool.query(
            `
            UPDATE server
            SET hostname = COALESCE($1, hostname),
                platform = COALESCE($2, platform),
                ip_address = COALESCE($3, ip_address)
            WHERE id = $4
            `,
            [
                hostname,
                platform,
                ip_address,
                server.id
            ]
        );

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
            metric.value !== null &&
            !Number.isNaN(Number(metric.value))
        );

        for (const metric of metrics) {
            await pool.query(
                `
                INSERT INTO metric_sample (
                    server_id,
                    metric_name,
                    value,
                    unit
                )
                VALUES ($1, $2, $3, $4)
                `,
                [
                    server.id,
                    metric.metric_name,
                    metric.value,
                    metric.unit
                ]
            );
        }

        if (top_cpu_process || top_memory_process) {
            await createLog({
                server_id: server.id,
                level: 'INFO',
                message: `Processos: CPU=${top_cpu_process || '-'} | MEM=${top_memory_process || '-'}`
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
                hostname: hostname || server.hostname,
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

router.post('/heartbeat', async (req, res) => {
    try {
        const token =
            req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                error: 'Token do agent não enviado'
            });
        }

        const serverResult = await pool.query(
            `
            SELECT *
            FROM server
            WHERE agent_token = $1
            LIMIT 1
            `,
            [token]
        );

        if (serverResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Token do agent inválido'
            });
        }

        const server = serverResult.rows[0];

        const {
            hostname,
            platform,
            ip_address
        } = req.body;

        await pool.query(
            `
            UPDATE server
            SET hostname = COALESCE($1, hostname),
                platform = COALESCE($2, platform),
                ip_address = COALESCE($3, ip_address)
            WHERE id = $4
            `,
            [
                hostname,
                platform,
                ip_address,
                server.id
            ]
        );

        await pool.query(
            `
            INSERT INTO server_heartbeat (
                server_id
            )
            VALUES ($1)
            `,
            [server.id]
        );

        res.json({
            success: true
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao receber heartbeat'
        });
    }
});

router.get('/alert-rules', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                ar.*,
                s.name AS server_name
            FROM alert_rule ar
            LEFT JOIN server s ON s.id = ar.server_id
            ORDER BY ar.created_at DESC
            `
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao buscar regras'
        });
    }
});

router.post('/alert-rules', authMiddleware, adminOnly, async (req, res) => {
    try {
        const {
            name,
            server_id,
            metric_name,
            operator,
            threshold,
            duration_seconds
        } = req.body;

        if (!name || !metric_name || !operator || !threshold) {
            return res.status(400).json({
                error: 'Campos obrigatórios ausentes'
            });
        }

        const cleanServerId =
            server_id && server_id !== 'all'
                ? server_id
                : null;

        const result = await pool.query(
            `
            INSERT INTO alert_rule (
                name,
                server_id,
                metric_name,
                operator,
                threshold,
                duration_seconds
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
            [
                name,
                cleanServerId,
                metric_name,
                operator,
                threshold,
                duration_seconds || 0
            ]
        );

        await createLog({
            level: 'INFO',
            message: `Regra de alerta criada: ${name}`
        });

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao criar regra'
        });
    }
});

router.delete('/alert-rules/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            `
            DELETE FROM alert
            WHERE rule_id = $1
            `,
            [id]
        );

        await pool.query(
            `
            DELETE FROM alert_rule
            WHERE id = $1
            `,
            [id]
        );

        await createLog({
            level: 'WARN',
            message: 'Regra de alerta removida'
        });

        res.json({
            success: true
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Erro ao remover regra'
        });
    }
});

module.exports = router;