//Qoida sozlash va HOSTEL tanishuv sozlamalari
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
    if (text === "📜 Qoida sozlash") {
      pushState(chatId, 'ADMIN_SET_RULES');
      return clearAndSend(chatId, `Joriy qoidalar:\n\n${db.settings.hostel_rules}\n\nYangi qoidalarni kiriting:`, backKeyboard);
    }
    if (text === "🏨 HOSTEL tanishuv sozlamalari") {
      pushState(chatId, 'ADMIN_SET_INFO');
      return clearAndSend(chatId, `Joriy ma'lumot:\n\n${db.settings.hostel_info}\n\nYangi ma'lumotni kiriting:`, backKeyboard);
    }
  }

  if (state === 'ADMIN_SET_RULES') {
    db.settings.hostel_rules = text; saveDB();
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    return clearAndSend(chatId, "Qoidalar yangilandi!", adminMainKeyboard);
  }
  if (state === 'ADMIN_SET_INFO') {
    db.settings.hostel_info = text; saveDB();
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    return clearAndSend(chatId, "Tanishuv ma'lumotlari yangilandi!", adminMainKeyboard);
  }
};
