//Yangi ID kiritish, Ism berish, Tahrirlash, O'chirish
const bot = require('../../../config/botConfig');
const { db, saveDB } = require('../../../core/database');
const { sessions, saveSessions } = require('../../../core/session');
const { pushState } = require('../../../utils/navigation');
const { clearAndSend } = require('../../../utils/helpers');
const { backKeyboard, adminMainKeyboard } = require('../../../config/keyboards');

module.exports = async (msg, state) => {
  const chatId = msg.chat.id; const text = msg.text;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (state === 'ADMIN_MAIN' && text === "👮‍♂️ Admin qoʻshish") {
    if (!db.superAdmins.includes(chatId)) return bot.sendMessage(chatId, "Sizda bu huquq yo'q!");
    pushState(chatId, 'ADMIN_ADD_ID');
    return clearAndSend(chatId, "Yangi adminning Telegram ID raqamini kiriting:", backKeyboard);
  }

  if (state === 'ADMIN_ADD_ID') {
    const newId = parseInt(text);
    if (!isNaN(newId)) {
      if (!db.admins.includes(newId)) db.admins.push(newId);
      saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      return clearAndSend(chatId, "Admin qo'shildi!", adminMainKeyboard);
    }
  }
};
