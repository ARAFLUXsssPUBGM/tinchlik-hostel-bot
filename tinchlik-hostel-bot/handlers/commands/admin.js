const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { sessions, saveSessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { adminMainKeyboard } = require('../../config/keyboards');

bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  if (!db.admins.includes(chatId)) {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    return bot.sendMessage(chatId, "Kechirasiz, Siz Admin paneliga kirish huquqiga ega emassiz...!");
  }
  if (!sessions[chatId]) sessions[chatId] = { history: [], lastMessageIds: [] };
  sessions[chatId].history = [];

  if (sessions[chatId].mainMenuUserMsgId) try { await bot.deleteMessage(chatId, sessions[chatId].mainMenuUserMsgId); } catch(e){}
  if (sessions[chatId].mainMenuBotMsgId) try { await bot.deleteMessage(chatId, sessions[chatId].mainMenuBotMsgId); } catch(e){}
  sessions[chatId].mainMenuUserMsgId = msg.message_id;

  pushState(chatId, 'ADMIN_MAIN');
  await clearAndSend(chatId, "👑 <b>Admin paneliga xush kelibsiz!</b>\nBarcha tizim boshqaruv elementlari quyida joylashgan:", adminMainKeyboard, true);
});
