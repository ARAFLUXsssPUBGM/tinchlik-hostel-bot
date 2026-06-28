//group_note_ (Eslatma yozish va guruhdagi xabarni avtomatik yangilash)
const bot = require('../../../config/botConfig');
const { db, saveDB } = require('../../../core/database');
const { sessions, saveSessions } = require('../../../core/session');

module.exports = async (msg, state) => {
  const chatId = msg.chat.id;
  if (state.startsWith('COMMENT_INPUT_')) {
    const targetId = state.replace('COMMENT_INPUT_', '');
    if (db.kvartirantlar[targetId]) {
      db.kvartirantlar[targetId].eslatma = msg.text; saveDB();
      bot.sendMessage(chatId, "Eslatma saqlandi.");
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    }
  }
};
