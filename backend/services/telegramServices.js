const axios = require('axios');

const BOT_TOKEN =
    process.env.TELEGRAM_BOT_TOKEN;

const CHAT_ID =
    process.env.TELEGRAM_CHAT_ID;

async function sendTelegramAlert({
    title,
    server,
    metric,
    value,
    severity = 'warning'
}) {

    if (!BOT_TOKEN || !CHAT_ID) {
        console.log(
            '[TELEGRAM] Bot token ou chat id não configurados'
        );

        return;
    }

    const emojiMap = {
        info: '🔵',
        warning: '⚠️',
        critical: '🚨'
    };

    const emoji =
        emojiMap[severity] || '⚠️';

    const message = `
${emoji} <b>${title}</b>

🖥️ <b>Servidor:</b> ${server}

📊 <b>Métrica:</b> ${metric}

📈 <b>Valor:</b> ${value}

🕒 <b>Horário:</b>
${new Date().toLocaleString('pt-BR')}
`;

    try {

        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            }
        );

        console.log(
            '[TELEGRAM] Alerta enviado'
        );

    } catch (error) {

        console.error(
            '[TELEGRAM ERROR]',
            error.response?.data || error.message
        );

    }

}

module.exports = {
    sendTelegramAlert
};