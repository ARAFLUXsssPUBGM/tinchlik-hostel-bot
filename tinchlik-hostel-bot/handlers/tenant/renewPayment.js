//Muddatni uzaytirish va To'lov turini tanlash
const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { sessions, saveSessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { formatMoney } = require('../../utils/formatters');
const { paymentTypeKeyboard, backKeyboard, kvartirantKeyboard } = require('../../config/keyboards');
const { sendRenewRequestToAdmins } = require('../../services/adminNotifier');

module.exports = async (msg, state) => {
  const chatId = msg.chat.id; const text = msg.text;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (state === 'KVAR_PAY_DURATION') {
    let ts = 0; let ed = new Date();
    if (text === "Oylik Toʻlov") { ts = sessions[chatId].renewData.pricePerMonth; ed.setMonth(ed.getMonth() + 1); } 
    else { const k = parseInt(text.match(/(\d+)/)[1]); ts = k * db.settings.daily_price; ed.setDate(ed.getDate() + k); }
    
    sessions[chatId].renewData.muddati = `${ed.getDate().toString().padStart(2,'0')}.${(ed.getMonth()+1).toString().padStart(2,'0')}.${ed.getFullYear()}`;
    sessions[chatId].renewData.summa = ts;
    pushState(chatId, 'KVAR_PAY_TYPE');
    return clearAndSend(chatId, `Summa: ${formatMoney(ts)}. To'lov turini tanlang:`, paymentTypeKeyboard);
  }
  
  if (state === 'KVAR_PAY_TYPE') {
    if (text === "💳 Karta orqali") {
      sessions[chatId].renewData.payType = text; pushState(chatId, 'KVAR_SEND_CHEK');
      return clearAndSend(chatId, "Chekni rasm shaklida yuboring:", backKeyboard);
    } else if (text === "💵 Naqd pul bilan") {
      sessions[chatId].renewData.payType = text; 
      await sendRenewRequestToAdmins(chatId, false);
      sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
      return clearAndSend(chatId, "To'lov so'rovi adminga yuborildi.", kvartirantKeyboard);
    }
  }
};
        
