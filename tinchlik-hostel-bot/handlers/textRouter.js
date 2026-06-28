const bot = require('../config/botConfig');
const { sessions, saveSessions } = require('../core/session');
const { popState, handleStateReturn } = require('../utils/navigation');

// Buyruqlarni ulash
require('./commands/start');
require('./commands/admin');
require('./commands/groupSetup');

// Mantiqiy modullarni ulash
const personalInfo = require('./registration/personalInfo');
const adminSettings = require('./admin/settings/hostelInfo');
const addItems = require('./admin/structure/addItems');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;
  if (!sessions[chatId]) sessions[chatId] = { state: 'MAIN_MENU', history: [], lastMessageIds: [] };

  const state = sessions[chatId].state;

  if (text === "⬅️ Ortga qaytish") {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const prevState = popState(chatId);
    sessions[chatId].state = prevState;
    saveSessions();
    return await handleStateReturn(chatId, prevState);
  }

  // State'ga qarab boshqa fayllarga yo'naltirish:
  if (state.startsWith('REG_')) return personalInfo(chatId, text, state, msg);
  if (state.startsWith('ADMIN_SET_')) return adminSettings(chatId, text, state, msg);
  if (state.startsWith('STRUCT_ADD_')) return addItems(chatId, text, state, msg);
  
  // Qolgan if/else mantiqlari o'z jildlaridagi kontrollerlarga uzatiladi...
});
