const axios = require('axios');
const si = require('systeminformation');
const os = require('os');

const API_BASE =
    process.env.API_BASE || 'http://localhost:3000/metrics';

const AGENT_TOKEN =
    process.env.AGENT_TOKEN;

const INTERVAL_MS =
    Number(process.env.AGENT_INTERVAL_MS || 10000);

const REQUEST_TIMEOUT_MS =
    Number(process.env.AGENT_REQUEST_TIMEOUT_MS || 8000);

let consecutiveFailures = 0;

if (!AGENT_TOKEN) {
    console.error('[AGENT FATAL] AGENT_TOKEN não definido.');
    process.exit(1);
}

const api = axios.create({
    baseURL: API_BASE,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`
    }
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getPrimaryIp() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }

    return null;
}

async function requestWithRetry(method, url, payload, retries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await api[method](url, payload);

            if (attempt > 1) {
                console.log(`[AGENT] Recuperado após tentativa ${attempt}`);
            }

            consecutiveFailures = 0;

            return response;
        } catch (error) {
            lastError = error;

            const status = error.response?.status;
            const message =
                error.response?.data || error.message;

            console.error(
                `[AGENT RETRY] ${url} tentativa ${attempt}/${retries}`,
                status || '',
                message
            );

            if (status === 401 || status === 403) {
                throw error;
            }

            await sleep(1000 * attempt);
        }
    }

    consecutiveFailures++;

    throw lastError;
}

async function collectPayload() {

    const cpu =
        await si.currentLoad();

    const memory =
        await si.mem();

    const diskList =
        await si.fsSize();

    const networkStats =
        await si.networkStats();

    const processes =
        await si.processes();

    const osInfo =
        await si.osInfo();

    const time =
        await si.time();

    const mainDisk =
        diskList.find(
            disk => disk.mount === '/'
        ) || diskList[0];

    const network =
        networkStats[0] || {};

    const processList =
        processes.list || [];

    const topCpuProcess =
        [...processList]
            .sort((a, b) => b.cpu - a.cpu)[0];

    const topMemoryProcess =
        [...processList]
            .sort((a, b) => b.memRss - a.memRss)[0];

    return {

        hostname:
            osInfo.hostname || os.hostname(),

        platform:
            osInfo.platform || process.platform,

        distro:
            osInfo.distro,

        release:
            osInfo.release,

        arch:
            osInfo.arch,

        ip_address:
            getPrimaryIp(),

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
                (mainDisk?.use || 0).toFixed(2)
            ),

        uptime_seconds:
            time.uptime,

        process_count:
            processes.all,

        network_rx_sec:
            network.rx_sec || 0,

        network_tx_sec:
            network.tx_sec || 0,

        top_cpu_process:
            topCpuProcess
                ? `${topCpuProcess.name} (${topCpuProcess.cpu.toFixed(2)}%)`
                : null,

        top_memory_process:
            topMemoryProcess
                ? `${topMemoryProcess.name}`
                : null
    };

}

async function sendMetrics() {
    const payload = await collectPayload();

    await requestWithRetry(
        'post',
        '/ingest',
        payload
    );

    console.log(
        `[METRICS] ${payload.hostname} | CPU ${payload.cpu}% | MEM ${payload.memory}% | DISK ${payload.disk}%`
    );
}

async function sendHeartbeat() {
    const osInfo = await si.osInfo();

    const payload = {
        hostname: osInfo.hostname || os.hostname(),
        platform: osInfo.platform || process.platform,
        ip_address: getPrimaryIp()
    };

    await requestWithRetry(
        'post',
        '/heartbeat',
        payload
    );

    console.log(`[HEARTBEAT] ${payload.hostname}`);
}

async function runAgent() {
    try {
        await sendMetrics();
        await sendHeartbeat();

        if (consecutiveFailures > 0) {
            console.warn(
                `[AGENT] Falhas consecutivas: ${consecutiveFailures}`
            );
        }
    } catch (error) {
        consecutiveFailures++;

        console.error(
            '[AGENT ERROR]',
            error.response?.data || error.message
        );

        if (consecutiveFailures >= 5) {
            console.error(
                `[AGENT CRITICAL] ${consecutiveFailures} falhas consecutivas. Aguardando próxima tentativa.`
            );
        }
    }
}

console.log('Monitor Agent iniciado');
console.log(`API_BASE: ${API_BASE}`);
console.log(`INTERVALO: ${INTERVAL_MS}ms`);
console.log(`TIMEOUT: ${REQUEST_TIMEOUT_MS}ms`);

runAgent();

setInterval(runAgent, INTERVAL_MS);