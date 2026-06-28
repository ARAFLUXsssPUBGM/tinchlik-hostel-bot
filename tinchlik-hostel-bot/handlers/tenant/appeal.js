//Adminga murojaat yo'llash (Matn + Rasm)
const bot = require('../../config/botConfig');
const { sessions, saveSessions } = require('../../core/session');
const { clearAndSend } = require('../../utils/helpers');
const { kvartirantKeyboard } = require('../../config/keyboards');
const { sendMurojaatToAdmins } = require('../../services/adminNotifier');

module.exports = async (msg, state) => {
  const chatId = msg.chat.id;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (state === 'KVAR_SEND_MUROJAAT' && msg.text) {
    await sendMurojaatToAdmins(chatId, null, msg.text);
    sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
    return clearAndSend(chatId, "Murojaatingiz adminga yuborildi!", kvartirantKeyboard);
  }
};
