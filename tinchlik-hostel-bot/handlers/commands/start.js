const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { sessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { mainKeyboard, kvartirantKeyboard } = require('../../config/keyboards');

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = sessions[chatId] || { history: [], lastMessageIds: [] }; sessions[chatId].history = [];
  try { if (sessions[chatId].mainMenuUserMsgId) await bot.deleteMessage(chatId, sessions[chatId].mainMenuUserMsgId); } catch(e){}
  try { if (sessions[chatId].mainMenuBotMsgId) await bot.deleteMessage(chatId, sessions[chatId].mainMenuBotMsgId); } catch(e){}
  sessions[chatId].mainMenuUserMsgId = msg.message_id;

  if (db.kvartirantlar[chatId] && ['aktiv', 'qarz'].includes(db.kvartirantlar[chatId].status)) {
    pushState(chatId, 'KVARTIRANT_MENU');
    await clearAndSend(chatId, `Assalomu alaykum <b>${db.kvartirantlar[chatId].filial || "HOSTEL"}</b> Profilingizga xush kelibsiz!`, kvartirantKeyboard, true);
  } else {
    pushState(chatId, 'MAIN_MENU');
    await clearAndSend(chatId, "<b>Tinchlik HOSTEL</b> tizimiga xush kelibsiz!", mainKeyboard, true);
  }
});
