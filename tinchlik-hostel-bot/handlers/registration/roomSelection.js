//Viloyat -> Filial -> Xona -> Yotoq tanlash
const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { sessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { formatMoney } = require('../../utils/formatters');

module.exports = async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const state = sessions[chatId].state;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (state === 'REG_CHOOSE_VILOYAT') {
    if (db.hostel_structure[text]) {
      sessions[chatId].regData.viloyat = text; pushState(chatId, 'REG_CHOOSE_FILIAL');
      const filiallar = Object.keys(db.hostel_structure[text] || {});
      if (filiallar.length === 0) return bot.sendMessage(chatId, "⚠️ Filiallar yo'q.");
      const kbd = { keyboard: filiallar.map(f => [{ text: f }]), resize_keyboard: true }; kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(chatId, "Filialni tanlang:", kbd);
    }
  }
  else if (state === 'REG_CHOOSE_FILIAL') {
    const vil = sessions[chatId].regData.viloyat;
    if (db.hostel_structure[vil][text]) {
      sessions[chatId].regData.filial = text; pushState(chatId, 'REG_CHOOSE_XONA');
      const xonalar = Object.keys(db.hostel_structure[vil][text] || {});
      const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true }; kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(chatId, "Xonani tanlang:", kbd);
    }
  }
  else if (state === 'REG_CHOOSE_XONA') {
    const vil = sessions[chatId].regData.viloyat; const fil = sessions[chatId].regData.filial;
    if (db.hostel_structure[vil][fil][text]) {
      sessions[chatId].regData.xona = text; pushState(chatId, 'REG_CHOOSE_YOTOQ');
      const barchaYotoqlar = db.hostel_structure[vil][fil][text] || {};
      const boShYotoqlar = Object.keys(barchaYotoqlar).filter(yKey => barchaYotoqlar[yKey].isFree === true);
      if (boShYotoqlar.length === 0) return bot.sendMessage(chatId, "⚠️ Xonada barcha joylar band!");
      const kbd = { keyboard: boShYotoqlar.map(y => [{ text: y }]), resize_keyboard: true }; kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(chatId, "Boʻsh yotoq joyini tanlang:", kbd);
    }
  }
  else if (state === 'REG_CHOOSE_YOTOQ') {
    const st = sessions[chatId].regData;
    if (db.hostel_structure[st.viloyat][st.filial][st.xona][text]) {
      if (!db.hostel_structure[st.viloyat][st.filial][st.xona][text].isFree) return bot.sendMessage(chatId, "⚠️ Joy band qilingan!");
      sessions[chatId].regData.yotoq = text;
      const oylikNarx = db.hostel_structure[st.viloyat][st.filial][st.xona][text].price || 0;
      sessions[chatId].regData.pricePerMonth = oylikNarx;
      pushState(chatId, 'REG_CHOOSE_DURATION');
      const durationKbd = { keyboard: [[{ text: "Oylik Toʻlov" }], [{ text: "1 kunlik" }, { text: "2 kunlik" }], [{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true };
      await clearAndSend(chatId, `Narx: <b>${formatMoney(oylikNarx)}/oyiga</b>.\nKunlik: <b>${formatMoney(db.settings.daily_price)}/kuniga</b>.\nIjara muddatini tanlang:`, durationKbd);
    }
  }
};
