const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { sessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { mainKeyboard, kvartirantKeyboard } = require('../../config/keyboards');

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) sessions[chatId] = { history: [], lastMessageIds: [] };
  sessions[chatId].history = [];

  if (sessions[chatId].mainMenuUserMsgId) try { await bot.deleteMessage(chatId, sessions[chatId].mainMenuUserMsgId); } catch(e){}
  if (sessions[chatId].mainMenuBotMsgId) try { await bot.deleteMessage(chatId, sessions[chatId].mainMenuBotMsgId); } catch(e){}
  sessions[chatId].mainMenuUserMsgId = msg.message_id;

  if (db.kvartirantlar[chatId] && ['aktiv', 'qarz'].includes(db.kvartirantlar[chatId].status)) {
    const filial = db.kvartirantlar[chatId].filial || "HOSTEL";
    pushState(chatId, 'KVARTIRANT_MENU');
    await clearAndSend(chatId, `Assalomu alaykum <b>${filial}</b> Profilingizga xush kelibsiz...❕`, kvartirantKeyboard, true);
  } else {
    pushState(chatId, 'MAIN_MENU');
    await clearAndSend(chatId, "<b>Tinchlik HOSTEL</b> tizimiga xush kelibsiz! Quyidagi tugmalardan birini tanlang:", mainKeyboard, true);
  }
});
