//Karta Sozlamalari (Raqam, Ega ismi) va KUNLIK Toʻlovni sozlash
const bot = require('../../../config/botConfig');
const { db, saveDB } = require('../../../core/database');
const { sessions } = require('../../../core/session');

module.exports = async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = sessions[chatId].state;

    if (state === 'ADMIN_SET_CARD_INPUT') {
        db.settings.card_number = text;
        saveDB();
        sessions[chatId].state = 'ADMIN_MAIN';
        await bot.sendMessage(chatId, "✅ Karta raqami yangilandi.");
    } else {
        sessions[chatId].state = 'ADMIN_SET_CARD_INPUT';
        await bot.sendMessage(chatId, "Iltimos, yangi karta raqamini kiriting:");
    }
};
