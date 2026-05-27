const axios = require('axios');
const si = require('systeminformation');
const os = require('os');

const API_BASE =
    process.env.API_BASE || 'http://localhost:3000/metrics';

const AGENT_TOKEN =
    process.env.AGENT_TOKEN;

const INTERVAL_MS =
    Number(process.env.AGENT_INTERVAL_MS || 5000);

if (!AGENT_TOKEN) {
    console.error('ERRO: AGENT_TOKEN não definido.');
    process.exit(1);
}

const api = axios.create({
    baseURL: API_BASE,
    timeout: 8000,
    headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`
    }
});

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

async function collectPayload() {
    const cpu = await si.currentLoad();
    const memory = await si.mem();
    const diskList = await si.fsSize();
    const osInfo = await si.osInfo();

    const mainDisk =
        diskList.find(disk => disk.mount === '/') ||
        diskList[0];

    return {
        hostname: osInfo.hostname,
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        arch: osInfo.arch,
        ip_address: getPrimaryIp(),

        cpu: Number(cpu.currentLoad.toFixed(2)),

        memory: Number(
            ((memory.used / memory.total) * 100).toFixed(2)
        ),

        disk: Number(
            (mainDisk?.use || 0).toFixed(2)
        )
    };
}

async function sendMetrics() {
    try {
        const payload = await collectPayload();

        await api.post('/ingest', payload);

        console.log(
            `[METRICS] ${payload.hostname} | CPU ${payload.cpu}% | MEM ${payload.memory}% | DISK ${payload.disk}%`
        );
    } catch (error) {
        console.error(
            '[METRICS ERROR]',
            error.response?.data || error.message
        );
    }
}

async function sendHeartbeat() {
    try {
        const osInfo = await si.osInfo();

        await api.post('/heartbeat', {
            hostname: osInfo.hostname,
            platform: osInfo.platform,
            ip_address: getPrimaryIp()
        });

        console.log(`[HEARTBEAT] ${osInfo.hostname}`);
    } catch (error) {
        console.error(
            '[HEARTBEAT ERROR]',
            error.response?.data || error.message
        );
    }
}

async function runAgent() {
    await sendMetrics();
    await sendHeartbeat();
}

console.log('Monitor Agent iniciado');
console.log(`API_BASE: ${API_BASE}`);
console.log(`INTERVALO: ${INTERVAL_MS}ms`);

runAgent();

setInterval(runAgent, INTERVAL_MS);