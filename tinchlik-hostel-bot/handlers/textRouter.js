const bot = require('../config/botConfig');
const { sessions, saveSessions } = require('../core/session');
const { popState, handleStateReturn } = require('../utils/navigation');
const { db } = require('../core/database');

const personalInfo = require('./registration/personalInfo');
const roomSelection = require('./registration/roomSelection');
const paymentSetup = require('./registration/paymentSetup');
const infoPanel = require('./tenant/infoPanel');
const renewPayment = require('./tenant/renewPayment');
const stats = require('./admin/statistics');
const broadcast = require('./admin/broadcast');
const settingsInfo = require('./admin/settings/hostelInfo');
const finance = require('./admin/settings/finance');
const addItems = require('./admin/structure/addItems');
const manage = require('./admin/adminControl/manage');
const groupNotes = require('./admin/tenantControl/groupNotes');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id; const text = msg.text;
  if (!text || text.startsWith('/')) return;
  sessions[chatId] = sessions[chatId] || { state: 'MAIN_MENU', history: [], lastMessageIds: [] };
  const state = sessions[chatId].state;

  if (text === "⬅️ Ortga qaytish") {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const pState = popState(chatId); sessions[chatId].state = pState; saveSessions();
    return await handleStateReturn(chatId, pState);
  }

  // Yuzlab yo'nalishlarni ajratib oluvchi modul chaqiruvlari:
  if (state === 'MAIN_MENU' || state.startsWith('REG_FISH') || state.startsWith('REG_BIRTH') || state.startsWith('REG_PHONE') || state.startsWith('REG_PASS') || state.startsWith('REG_JSHSHIR') || state.startsWith('REG_GENDER')) return personalInfo(msg, state);
  if (state.startsWith('REG_CHOOSE_')) return roomSelection(msg, state);
  if (state.startsWith('REG_PAYMENT_')) return paymentSetup(msg, state);
  if (state === 'KVARTIRANT_MENU') return infoPanel(msg, state);
  if (state.startsWith('KVAR_PAY_')) return renewPayment(msg, state);

  if (db.admins.includes(chatId)) {
    if (state === 'ADMIN_MAIN') {
      if (text === "📊 STATISTIKA") return stats(msg);
      if (text === "📢 Xabarnoma") return broadcast(msg, state);
      if (text === "📜 Qoida sozlash" || text === "🏨 HOSTEL tanishuv sozlamalari") return settingsInfo(msg, state);
      if (text === "💳 Karta Sozlamalari" || text === "⛅ KUNLIK Toʻlovni sozlash") return finance(msg, state);
      if (text === "👮‍♂️ Admin qoʻshish") return manage(msg, state);
      if (text === "🏨 HOSTEL Sozlash") return addItems(msg, state);
    }
    if (state.startsWith('ADMIN_SET_RULES') || state.startsWith('ADMIN_SET_INFO')) return settingsInfo(msg, state);
    if (state.startsWith('ADMIN_SET_DAILY') || state.startsWith('ADMIN_SET_CARD')) return finance(msg, state);
    if (state === 'ADMIN_BROADCAST') return broadcast(msg, state);
    if (state.startsWith('ADMIN_HOSTEL_STRUCT') || state.startsWith('STRUCT_ADD_')) return addItems(msg, state);
    if (state.startsWith('ADMIN_ADD_') || state.startsWith('ADMIN_INPUT_') || state.startsWith('ADMIN_EDIT_') || state === 'ADMIN_MANAGE_ROLE') return manage(msg, state);
    if (state.startsWith('COMMENT_INPUT_')) return groupNotes(msg, state);
  }
});
      
