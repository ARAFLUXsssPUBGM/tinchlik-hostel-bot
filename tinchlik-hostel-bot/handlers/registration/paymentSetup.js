//Muddati (Kunlik/Oylik) va To'lov turi (Karta/Naqd)
const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { sessions, saveSessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { backKeyboard, mainKeyboard } = require('../../config/keyboards');
const { sendRequestToAdmins } = require('../../services/adminNotifier');

module.exports = async (msg, state) => {
  const chatId = msg.chat.id; try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
  if (state === 'REG_PAYMENT_TYPE') {
    if (msg.text === "💳 Karta orqali") {
      sessions[chatId].regData.payType = msg.text; pushState(chatId, 'REG_SEND_CHEK');
      return clearAndSend(chatId, `Karta raqam: ${db.settings.card_number}\nEga: ${db.settings.card_owner}\nChekni rasm shaklida yuboring:`, backKeyboard);
    } else if (msg.text === "💵 Naqd pul bilan") {
      sessions[chatId].regData.payType = msg.text; await sendRequestToAdmins(chatId, false);
      sessions[chatId].state = 'MAIN_MENU'; saveSessions();
      return clearAndSend(chatId, "So'rov adminga ketdi.", mainKeyboard);
    }
  }
};
