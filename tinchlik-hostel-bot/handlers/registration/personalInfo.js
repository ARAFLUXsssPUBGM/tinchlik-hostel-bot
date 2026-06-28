//FISH, Tug'ilgan sana, Telefon, Pasport, JSHSHIR, Jins
const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { sessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { backKeyboard, mainKeyboard } = require('../../config/keyboards');

module.exports = async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const state = sessions[chatId].state;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (state === 'MAIN_MENU') {
    if (text === "👤 Roʻyxatdan oʻtish") {
      pushState(chatId, 'REG_FISH');
      await clearAndSend(chatId, "1. Iltimos, Familiya Ism Sharifingizni (F.I.SH) kiriting:", backKeyboard);
    } else if (text === "🏨 HOSTEL bilan tanishish") {
      await clearAndSend(chatId, `🏨 <b>HOSTEL Haqida:</b>\n\n${db.settings.hostel_info}`, mainKeyboard);
    } else if (text === "🛂 HOSTEL Qoidalar") {
      await clearAndSend(chatId, `🛂 <b>HOSTEL Qoidalari:</b>\n\n${db.settings.hostel_rules}`, mainKeyboard);
    }
  }
  else if (state === 'REG_FISH') { sessions[chatId].regData = { fish: text }; pushState(chatId, 'REG_BIRTHTIME'); await clearAndSend(chatId, "2. Tugʻilgan sanangizni kiriting:", backKeyboard); }
  else if (state === 'REG_BIRTHTIME') { sessions[chatId].regData.birth = text; pushState(chatId, 'REG_PHONE'); await clearAndSend(chatId, "3. Telefon raqamingizni kiriting:", backKeyboard); }
  else if (state === 'REG_PHONE') { sessions[chatId].regData.phone = text; pushState(chatId, 'REG_PASSPORT'); await clearAndSend(chatId, "4. Pasport Seriya va Raqamini kiriting:", backKeyboard); }
  else if (state === 'REG_PASSPORT') { sessions[chatId].regData.passport = text; pushState(chatId, 'REG_JSHSHIR'); await clearAndSend(chatId, "5. Pasportdagi 14 xonali JSHSHIR kiriting:", backKeyboard); }
  else if (state === 'REG_JSHSHIR') { sessions[chatId].regData.jshshir = text; pushState(chatId, 'REG_SELFIE'); await clearAndSend(chatId, "6. Yuzingiz aniq koʻringan Selfi Rasmingizni botga yuboring:", backKeyboard); }
  else if (state === 'REG_GENDER') {
    if (text === "Erkak" || text === "Ayol") {
      sessions[chatId].regData.gender = text; pushState(chatId, 'REG_CHOOSE_VILOYAT');
      const viloyatlar = Object.keys(db.hostel_structure || {});
      if (viloyatlar.length === 0) { sessions[chatId].state = 'MAIN_MENU'; return await clearAndSend(chatId, "⚠️ Tizimda viloyat yo'q.", mainKeyboard); }
      const kbd = { keyboard: viloyatlar.map(v => [{ text: v }]), resize_keyboard: true }; kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(chatId, "7. Viloyatni tanlang:", kbd);
    }
  }
};
