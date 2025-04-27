const TelegramBot = require('node-telegram-bot-api');

// Create a bot instance
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendNotification(message) {
    try {
        await bot.sendMessage(CHAT_ID, message, { parse_mode: 'HTML' });
        console.log('Telegram notification sent successfully');
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
    }
}

module.exports = {
    sendPriceAlert: async (productName, currentPrice, targetPrice, url) => {
        const message = `
🔔 <b>Price Alert!</b>

Product: ${productName}
Current Price: ₹${currentPrice}
Target Price: ₹${targetPrice}
URL: ${url}

Time: ${new Date().toLocaleString()}`;

        await sendNotification(message);
    },

    sendTestAlert: async (productName, currentPrice, url) => {
        const message = `
🔔 <b>Test Alert</b>

Product: ${productName}
Current Price: ₹${currentPrice}
URL: ${url}

Time: ${new Date().toLocaleString()}`;

        await sendNotification(message);
    }
}; 