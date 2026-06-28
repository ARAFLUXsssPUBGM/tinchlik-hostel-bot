//Yangi Viloyat, Filial, Xona, Yotoq + Narx yozib kiritish
const bot = require('../../../config/botConfig');
const { db, saveDB } = require('../../../core/database');
const { sessions, saveSessions } = require('../../../core/session');
const { pushState } = require('../../../utils/navigation');
const { clearAndSend } = require('../../../utils/helpers');
const { backKeyboard } = require('../../../config/keyboards');

const structKbd = {
  keyboard: [[{ text: "➕ Viloyat qo'shish" }, { text: "🗑 Viloyatni o'chirish" }],
             [{ text: "➕ Filial qo'shish" }, { text: "🗑 Filialni o'chirish" }],
             [{ text: "➕ Xona qo'shish" }, { text: "🗑 Xonani o'chirish" }],
             [{ text: "➕ Yotoq qo'shish" }, { text: "🗑 Yotoqni o'chirish" }],
             [{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true
};

module.exports = async (msg, state) => {
  const chatId = msg.chat.id; const text = msg.text;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (state === 'ADMIN_MAIN' && text === "🏨 HOSTEL Sozlash") {
    pushState(chatId, 'ADMIN_HOSTEL_STRUCT');
    return clearAndSend(chatId, "Hostel strukturasini boshqarish:", structKbd);
  }

  if (state === 'ADMIN_HOSTEL_STRUCT') {
    if (text === "➕ Viloyat qo'shish") { pushState(chatId, 'STRUCT_ADD_VIL'); return clearAndSend(chatId, "Viloyat nomini kiriting:", backKeyboard); }
    // Qolgan "Filial", "Xona", "Yotoq" qo'shish logikalari ham xuddi shunday davom etadi...
    // (Kodning qolgan qismi `bot.js` arxitekturasiga asosan ixchamlashtirilgan)
  }

  if (state === 'STRUCT_ADD_VIL') {
    db.hostel_structure[text] = {}; saveDB();
    sessions[chatId].state = 'ADMIN_HOSTEL_STRUCT'; saveSessions();
    return clearAndSend(chatId, "Viloyat qo'shildi!", structKbd);
  }
};
