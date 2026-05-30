const axios = require('axios');

const si = require('systeminformation');

const cron = require('node-cron');

const API_BASE =
    process.env.API_BASE ||
    'http://backend:3000/metrics';

const AGENT_TOKEN =
    process.env.AGENT_TOKEN || '';

async function collectMetrics() {

    try {

        const cpu =
            await si.currentLoad();

        const memory =
            await si.mem();

        const disk =
            await si.fsSize();

        const osInfo =
            await si.osInfo();

        const networkStats =
            await si.networkStats();

        const processes =
            await si.processes();

        const network =
            networkStats[0] || {};

        const topCpuProcess =
            processes.list
                ?.sort((a, b) => b.cpu - a.cpu)[0];

        const topMemoryProcess =
            processes.list
                ?.sort((a, b) => b.memRss - a.memRss)[0];

        const payload = {

            hostname:
                osInfo.hostname,

            platform:
                osInfo.platform,

            ip_address:
                null,

            cpu:
                Number(
                    cpu.currentLoad.toFixed(2)
                ),

            memory:
                Number(
                    (
                        (
                            memory.used /
                            memory.total
                        ) * 100
                    ).toFixed(2)
                ),

            disk:
                Number(
                    disk[0].use.toFixed(2)
                ),

            uptime_seconds:
                osInfo.uptime,

            process_count:
                processes.all,

            top_cpu_process:
                topCpuProcess
                    ? `${topCpuProcess.name} (${topCpuProcess.cpu.toFixed(2)}%)`
                    : null,

            top_memory_process:
                topMemoryProcess
                    ? `${topMemoryProcess.name}`
                    : null,

            network_rx_sec:
                network.rx_sec || 0,

            network_tx_sec:
                network.tx_sec || 0

        };

        await axios.post(

            `${API_BASE}/ingest`,

            payload,

            {

                headers: {

                    Authorization:
                        `Bearer ${AGENT_TOKEN}`

                }

            }

        );

        console.log(
            '[AGENT] Métricas enviadas'
        );

    } catch (error) {

        console.error(
            '[AGENT ERROR]',
            error.message
        );

    }

}

async function sendHeartbeat() {

    try {

        const osInfo =
            await si.osInfo();

        await axios.post(

            `${API_BASE}/heartbeat`,

            {

                hostname:
                    osInfo.hostname,

                platform:
                    osInfo.platform

            },

            {

                headers: {

                    Authorization:
                        `Bearer ${AGENT_TOKEN}`

                }

            }

        );

        console.log(
            '[AGENT] Heartbeat enviado'
        );

    } catch (error) {

        console.error(
            '[HEARTBEAT ERROR]',
            error.message
        );

    }

}

cron.schedule('*/5 * * * * *', () => {

    collectMetrics();

});

cron.schedule('*/10 * * * * *', () => {

    sendHeartbeat();

});

console.log(
    '[AGENT] Inicializado'
);