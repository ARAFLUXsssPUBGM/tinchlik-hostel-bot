//Viloyat -> Filial -> Xona -> Yotoq tanlash
const { db } = require('../../core/database');
const { sessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { formatMoney } = require('../../utils/formatters');
const bot = require('../../config/botConfig');

module.exports = async (msg, state) => {
  const chatId = msg.chat.id; const text = msg.text; try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
  if (state === 'REG_CHOOSE_VILOYAT' && db.hostel_structure[text]) {
    sessions[chatId].regData.viloyat = text; pushState(chatId, 'REG_CHOOSE_FILIAL');
    const fils = Object.keys(db.hostel_structure[text]); const kbd = { keyboard: fils.map(f => [{text: f}]), resize_keyboard: true }; kbd.keyboard.push([{text: "⬅️ Ortga qaytish"}]);
    return clearAndSend(chatId, "Filialni tanlang:", kbd);
  }
  if (state === 'REG_CHOOSE_FILIAL') {
    const vil = sessions[chatId].regData.viloyat; sessions[chatId].regData.filial = text; pushState(chatId, 'REG_CHOOSE_XONA');
    const xonalar = Object.keys(db.hostel_structure[vil][text]); const kbd = { keyboard: xonalar.map(x => [{text: x}]), resize_keyboard: true }; kbd.keyboard.push([{text: "⬅️ Ortga qaytish"}]);
    return clearAndSend(chatId, "Xonani tanlang:", kbd);
  }
  if (state === 'REG_CHOOSE_XONA') {
    const vil = sessions[chatId].regData.viloyat; const fil = sessions[chatId].regData.filial; sessions[chatId].regData.xona = text; pushState(chatId, 'REG_CHOOSE_YOTOQ');
    const yotoqlar = Object.keys(db.hostel_structure[vil][fil][text]).filter(y => db.hostel_structure[vil][fil][text][y].isFree);
    const kbd = { keyboard: yotoqlar.map(y => [{text: y}]), resize_keyboard: true }; kbd.keyboard.push([{text: "⬅️ Ortga qaytish"}]);
    return clearAndSend(chatId, "Bo'sh yotoqni tanlang:", kbd);
  }
  if (state === 'REG_CHOOSE_YOTOQ') {
    const rd = sessions[chatId].regData; rd.yotoq = text; rd.pricePerMonth = db.hostel_structure[rd.viloyat][rd.filial][rd.xona][text].price;
    pushState(chatId, 'REG_CHOOSE_DURATION');
    const dKbd = { keyboard: [[{text: "Oylik Toʻlov"}], [{text: "1 kunlik"}, {text: "2 kunlik"}], [{text: "⬅️ Ortga qaytish"}]], resize_keyboard: true };
    return clearAndSend(chatId, `Muddatni tanlang. Oylik: ${formatMoney(rd.pricePerMonth)}`, dKbd);
  }
  if (state === 'REG_CHOOSE_DURATION') {
    let ts = 0; let ed = new Date();
    if (text === "Oylik Toʻlov") { ts = sessions[chatId].regData.pricePerMonth; ed.setMonth(ed.getMonth() + 1); } 
    else { const k = parseInt(text.match(/(\d+)/)[1]); ts = k * db.settings.daily_price; ed.setDate(ed.getDate() + k); }
    const rd = sessions[chatId].regData; rd.muddati = `${ed.getDate().toString().padStart(2,'0')}.${(ed.getMonth()+1).toString().padStart(2,'0')}.${ed.getFullYear()}`; rd.summa = ts; rd.durType = text;
    pushState(chatId, 'REG_PAYMENT_TYPE');
    const { paymentTypeKeyboard } = require('../../config/keyboards');
    return clearAndSend(chatId, `To'lov: ${formatMoney(ts)}. Turni belgilang:`, paymentTypeKeyboard);
  }
};
