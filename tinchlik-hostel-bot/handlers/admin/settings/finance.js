//Karta Sozlamalari (Raqam, Ega ismi) va KUNLIK Toʻlovni sozlash
const bot = require('../../../config/botConfig');
const { db, saveDB } = require('../../../core/database');
const { sessions, saveSessions } = require('../../../core/session');
const { pushState } = require('../../../utils/navigation');
const { clearAndSend } = require('../../../utils/helpers');
const { backKeyboard, adminMainKeyboard } = require('../../../config/keyboards');

module.exports = async (msg, state) => {
  const chatId = msg.chat.id; const text = msg.text;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (state === 'ADMIN_MAIN') {
    if (text === "💳 Karta Sozlamalari") {
      pushState(chatId, 'ADMIN_SET_CARD');
      return clearAndSend(chatId, "Yangi karta raqamini va egasini kiriting (Masalan: 8600123456789012 Aliyev Valiy):", backKeyboard);
    }
    if (text === "⛅ KUNLIK Toʻlovni sozlash") {
      pushState(chatId, 'ADMIN_SET_DAILY');
      return clearAndSend(chatId, `Joriy kunlik narx: ${db.settings.daily_price}\nYangi narxni kiriting (faqat raqam):`, backKeyboard);
    }
  }

  if (state === 'ADMIN_SET_CARD') {
    const parts = text.split(' ');
    if (parts.length > 1) {
      db.settings.card_number = parts[0];
      db.settings.card_owner = parts.slice(1).join(' ');
      saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      return clearAndSend(chatId, "Karta ma'lumotlari yangilandi!", adminMainKeyboard);
    }
  }
  
  if (state === 'ADMIN_SET_DAILY') {
    const p = parseInt(text);
    if (!isNaN(p)) {
      db.settings.daily_price = p; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      return clearAndSend(chatId, "Kunlik narx yangilandi!", adminMainKeyboard);
    }
  }
};
