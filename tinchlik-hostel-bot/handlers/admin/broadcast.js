//📢 Xabarnoma (Barchaga global e'lon jo'natish)
const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { sessions, saveSessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { backKeyboard, adminMainKeyboard } = require('../../config/keyboards');

module.exports = async (msg, state) => {
  const chatId = msg.chat.id; const text = msg.text;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (state === 'ADMIN_MAIN' && text === "📢 Xabarnoma") {
    pushState(chatId, 'ADMIN_BROADCAST');
    return clearAndSend(chatId, "Barcha foydalanuvchilarga yuboriladigan xabarni kiriting:", backKeyboard);
  }

  if (state === 'ADMIN_BROADCAST') {
    let sentCount = 0;
    for (let userId in db.kvartirantlar) {
      try {
        await bot.sendMessage(userId, `📢 <b>XABARNOMA:</b>\n\n${text}`, { parse_mode: 'HTML' });
        sentCount++;
      } catch(e){}
    }
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    return clearAndSend(chatId, `Xabar ${sentCount} kishiga yuborildi.`, adminMainKeyboard);
  }
};
