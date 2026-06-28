const { sessions, saveSessions } = require('../core/session');
const { clearAndSend } = require('./helpers');
const { mainKeyboard, adminMainKeyboard, kvartirantKeyboard } = require('../config/keyboards');
const { db } = require('../core/database');

module.exports = {
  pushState: (chatId, state) => {
    sessions[chatId] = sessions[chatId] || { history: [], lastMessageIds: [] };
    sessions[chatId].history = sessions[chatId].history || [];
    sessions[chatId].history.push(state);
    sessions[chatId].state = state;
    saveSessions();
  },
  popState: (chatId) => {
    if (!sessions[chatId]?.history || sessions[chatId].history.length <= 1) return 'MAIN_MENU';
    sessions[chatId].history.pop();
    return sessions[chatId].history.pop() || 'MAIN_MENU';
  },
  handleStateReturn: async (chatId, prevState) => {
    if (prevState === 'MAIN_MENU') {
      if (db.kvartirantlar[chatId] && ['aktiv', 'qarz'].includes(db.kvartirantlar[chatId].status)) return await clearAndSend(chatId, "Asosiy paneli:", kvartirantKeyboard);
      await clearAndSend(chatId, "Asosiy menyu:", mainKeyboard);
    } else if (prevState === 'ADMIN_MAIN') { await clearAndSend(chatId, "👑 Admin panel:", adminMainKeyboard); } 
    else if (prevState === 'ADMIN_HOSTEL_STRUCT') {
      const kbd = { keyboard: [[{ text: "➕ Viloyat qo'shish" }, { text: "🗑 Viloyatni o'chirish" }], [{ text: "➕ Filial qo'shish" }, { text: "🗑 Filialni o'chirish" }], [{ text: "➕ Xona qo'shish" }, { text: "🗑 Xonani o'chirish" }], [{ text: "➕ Yotoq qo'shish" }, { text: "🗑 Yotoqni o'chirish" }], [{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true };
      await clearAndSend(chatId, "Struktura:", kbd);
    } else if (prevState === 'KVARTIRANT_MENU') { await clearAndSend(chatId, "Profilingiz:", kvartirantKeyboard); }
  }
};
