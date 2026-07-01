//FISH, Tug'ilgan sana, Telefon, Pasport, JSHSHIR, Jins
// 21. personalInfo.js
const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { sessions } = require('../../core/session');
const { pushState } = require('../../utils/navigation');
const { clearAndSend } = require('../../utils/helpers');
const { backKeyboard, mainKeyboard } = require('../../config/keyboards');

module.exports = async (msg, state) => {
  const chatId = msg.chat.id; const text = msg.text; 
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
  
  // Tuzatildi: barcha joylarga bot argumenti qaytarildi
  if (state === 'MAIN_MENU') {
    if (text === "👤 Roʻyxatdan oʻtish") { pushState(chatId, 'REG_FISH'); return clearAndSend(bot, chatId, "1. To'liq F.I.SH (Familiya, Ism, Sharifingiz) ni kiriting:", backKeyboard); }
    if (text === "🏨 HOSTEL bilan tanishish") return clearAndSend(bot, chatId, db.settings.hostel_info, mainKeyboard);
    if (text === "🛂 HOSTEL Qoidalar") return clearAndSend(bot, chatId, db.settings.hostel_rules, mainKeyboard);
  }
  if (state === 'REG_FISH') { sessions[chatId].regData = { fish: text }; pushState(chatId, 'REG_BIRTHTIME'); return clearAndSend(bot, chatId, "2. Tug'ilgan sanangizni kiriting (Masalan: kun.oy.yil):", backKeyboard); }
  if (state === 'REG_BIRTHTIME') { sessions[chatId].regData.birth = text; pushState(chatId, 'REG_PHONE'); return clearAndSend(bot, chatId, "3. Telefon raqamingizni kiriting (Masalan: +998700350607):", backKeyboard); }
  if (state === 'REG_PHONE') { sessions[chatId].regData.phone = text; pushState(chatId, 'REG_PASSPORT'); return clearAndSend(bot, chatId, "4. Pasport seriyasi va raqamini kiriting (Masalan: AA1234567):", backKeyboard); }
  if (state === 'REG_PASSPORT') { sessions[chatId].regData.passport = text; pushState(chatId, 'REG_JSHSHIR'); return clearAndSend(bot, chatId, "5. Pasport orqasidagi JSHSHIR (14 xonali shaxsiy raqamingiz) ni kiriting:", backKeyboard); }
  if (state === 'REG_JSHSHIR') { sessions[chatId].regData.jshshir = text; pushState(chatId, 'REG_SELFIE'); return clearAndSend(bot, chatId, "6. Iltimos, yuzingiz aniq ko'ringan bitta selfi rasmingizni yuboring:", backKeyboard); }
  if (state === 'REG_GENDER' && (text === "Erkak" || text === "Ayol")) {
    sessions[chatId].regData.gender = text; pushState(chatId, 'REG_CHOOSE_VILOYAT');
    const vils = Object.keys(db.hostel_structure || {});
    if (!vils.length) { sessions[chatId].state = 'MAIN_MENU'; return clearAndSend(bot, chatId, "Hozircha tizimga viloyatlar kiritilmagan.", mainKeyboard); }
    const kbd = { keyboard: vils.map(v => [{text: v}]), resize_keyboard: true }; kbd.keyboard.push([{text: "⬅️ Ortga qaytish"}]);
    return clearAndSend(bot, chatId, "7. O'zingizga qulay viloyatni tanlang:", kbd);
  }
};
