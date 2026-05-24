const axios = require('axios');
const si = require('systeminformation');
const cron = require('node-cron');

const API_BASE =
    process.env.API_BASE || 'http://localhost:3000/metrics';

const AGENT_TOKEN = 'agent-local-123';

async function collectPayload() {

    const cpu = await si.currentLoad();
    const memory = await si.mem();
    const disk = await si.fsSize();
    const os = await si.osInfo();

    return {
        hostname: os.hostname,

        cpu: Number(
            cpu.currentLoad.toFixed(2)
        ),

        memory: Number(
            (
                (
                    memory.used /
                    memory.total
                ) * 100
            ).toFixed(2)
        ),

        disk: Number(
            disk[0].use.toFixed(2)
        )
    };

}

async function sendMetrics() {

    try {

        const payload =
            await collectPayload();

        console.log(
            'Enviando métricas:',
            payload
        );

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
            'Métricas enviadas'
        );

    } catch (error) {

        console.error(
            'Erro métricas:',
            error.response?.data ||
            error.message
        );

    }

}

async function sendHeartbeat() {

    try {

        const os =
            await si.osInfo();

        await axios.post(
            `${API_BASE}/heartbeat`,
            {
                hostname:
                    os.hostname
            },
            {
                headers: {
                    Authorization:
                        `Bearer ${AGENT_TOKEN}`
                }
            }
        );

        console.log(
            'Heartbeat enviado'
        );

    } catch (error) {

        console.error(
            'Erro heartbeat:',
            error.response?.data ||
            error.message
        );

    }

}

cron.schedule('*/5 * * * * *', async () => {

    await sendMetrics();

    await sendHeartbeat();

});

sendMetrics();

sendHeartbeat();