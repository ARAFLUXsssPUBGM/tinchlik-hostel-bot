const bot = require('../config/botConfig');
const { sessions, saveSessions } = require('../core/session');
const { popState, handleStateReturn } = require('../utils/navigation');
const { db } = require('../core/database');

// Barcha modullarni chaqirish
require('./commands/start');
require('./commands/admin');
require('./commands/groupSetup');
const personalInfo = require('./registration/personalInfo');
const roomSelection = require('./registration/roomSelection');
const paymentSetup = require('./registration/paymentSetup');
const infoPanel = require('./tenant/infoPanel');
const renewPayment = require('./tenant/renewPayment');
const statistics = require('./admin/statistics');
const broadcast = require('./admin/broadcast');
const hostelInfo = require('./admin/settings/hostelInfo');
const finance = require('./admin/settings/finance');
const addItems = require('./admin/structure/addItems');
const manageAdmin = require('./admin/adminControl/manage');
const rolesAdmin = require('./admin/adminControl/roles');
const groupNotes = require('./admin/tenantControl/groupNotes');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;
  if (!sessions[chatId]) sessions[chatId] = { state: 'MAIN_MENU', history: [], lastMessageIds: [] };
  const state = sessions[chatId].state;

  if (text === "⬅️ Ortga qaytish") {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const prevState = popState(chatId);
    sessions[chatId].state = prevState; saveSessions();
    return await handleStateReturn(chatId, prevState);
  }

  // Router yo'naltirishlari
  if (state === 'MAIN_MENU') return personalInfo(msg); 
  if (state.startsWith('REG_FISH') || state.startsWith('REG_BIRTH') || state.startsWith('REG_PHONE') || state.startsWith('REG_PASS') || state.startsWith('REG_JSHSHIR') || state.startsWith('REG_GENDER')) return personalInfo(msg);
  if (state.startsWith('REG_CHOOSE_')) return roomSelection(msg);
  if (state.startsWith('REG_PAYMENT_')) return paymentSetup(msg);
  
  if (state === 'KVARTIRANT_MENU') return infoPanel(msg);
  if (state.startsWith('KVAR_PAY_')) return renewPayment(msg);

  if (db.admins.includes(chatId) && state.startsWith('ADMIN_')) {
    if (state === 'ADMIN_MAIN') {
       if (text === "📊 STATISTIKA") return statistics(msg);
       if (text === "📢 Xabarnoma") return broadcast(msg);
       if (text === "📜 Qoida sozlash" || text === "🏨 HOSTEL tanishuv sozlamalari") return hostelInfo(msg);
       if (text === "💳 Karta Sozlamalari" || text === "⛅ KUNLIK Toʻlovni sozlash") return finance(msg);
       if (text === "🏨 HOSTEL Sozlash") return addItems(msg); // Structure menu
       if (text === "👮‍♂️ Admin qoʻshish") return manageAdmin(msg);
    }
    if (state.startsWith('ADMIN_SET_RULES') || state.startsWith('ADMIN_SET_INFO')) return hostelInfo(msg);
    if (state.startsWith('ADMIN_SET_DAILY') || state.startsWith('ADMIN_SET_CARD')) return finance(msg);
    if (state === 'ADMIN_BROADCAST') return broadcast(msg);
    if (state.startsWith('ADMIN_HOSTEL_STRUCT') || state.startsWith('STRUCT_ADD_')) return addItems(msg);
    if (state.startsWith('ADMIN_ADD_') || state.startsWith('ADMIN_INPUT_') || state.startsWith('ADMIN_EDIT_')) return manageAdmin(msg);
    if (state === 'ADMIN_MANAGE_ROLE') return rolesAdmin(msg);
  }

  if (state.startsWith('COMMENT_INPUT_')) return groupNotes(msg);
});
