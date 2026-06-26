// REG_ bilan boshlanuvchi foydalanuvchi holatlarini (state) qayta ishlovchi modul
const { pushState, popState, saveSessions } = require('../config/sessions');
const { clearAndSend } = require('../utils/interface');
const { backKeyboard, mainKeyboard } = require('../keyboards/keyboards');

async function handleRegistration(bot, msg, db, sessions) {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : "";
  const state = sessions[chatId]?.state;

  if (!state || !state.startsWith('REG_')) return false;

  // Umumiy "Ortga qaytish" mantiqi
  if (text === "⬅️ Ortga qaytish") {
    const prevState = popState(chatId);
    if (prevState) {
      await rollbackRegistrationStep(bot, chatId, prevState, sessions);
      return true;
    }
  }

  switch (state) {
    case 'REG_NAME':
      if (text.length < 5) {
        await bot.sendMessage(chatId, "⚠️ F.I.SH juda qisqa. Iltimos, to'liq familiya, ism va otangizning ismini kiriting:");
        return true;
      }
      sessions[chatId].regData = { fish: text };
      pushState(chatId, 'REG_BIRTH');
      await clearAndSend(bot, chatId, "📅 Tug'ilgan sanangizni kiriting (Masalan: DD.MM.YYYY):\n<i>Sana formati qat'iy bo'lishi shart!</i>", backKeyboard);
      break;

    case 'REG_BIRTH':
      const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
      if (!dateRegex.test(text)) {
        await bot.sendMessage(chatId, "⚠️ Noto'g'ri sana formati! Iltimos, DD.MM.YYYY ko'rinishida kiriting (Masalan: 25.10.1998):");
        return true;
      }
      sessions[chatId].regData.birth = text;
      pushState(chatId, 'REG_PASSPORT');
      await clearAndSend(bot, chatId, "🪪 Pasport seriyasi va raqamini kiriting (Masalan: AA1234567 yoki FA7654321):", backKeyboard);
      break;

    case 'REG_PASSPORT':
      const passText = text.replace(/\s+/g, '').toUpperCase();
      if (passText.length < 7 || passText.length > 12) {
        await bot.sendMessage(chatId, "⚠️ Pasport ma'lumotlari noto'g'ri kiritildi. Qaytadan urinib ko'ring:");
        return true;
      }
      sessions[chatId].regData.passport = passText;
      pushState(chatId, 'REG_JSHSHIR');
      await clearAndSend(bot, chatId, "🆔 Pasportingizdagi 14 xonali JSHSHIR (ПИНФЛ) kodini kiriting:\n<i>(Xatolikka yo'l qo'ymaslik uchun diqqat qiling)</i>", backKeyboard);
      break;

    case 'REG_JSHSHIR':
      const jshshirText = text.replace(/\s+/g, '');
      if (jshshirText.length !== 14 || isNaN(jshshirText)) {
        await bot.sendMessage(chatId, "⚠️ JSHSHIR qat'iy 14 ta raqamdan iborat bo'lishi kerak. Tekshirib qayta kiriting:");
        return true;
      }
      sessions[chatId].regData.jshshir = jshshirText;
      pushState(chatId, 'REG_PHONE');
      await clearAndSend(bot, chatId, "📞 Telefon raqamingizni kiriting (Masalan: +998901234567 ko'rinishida):", backKeyboard);
      break;

    case 'REG_PHONE':
      if (text.length < 9) {
        await bot.sendMessage(chatId, "⚠️ Telefon raqami noto'g'ri. Qayta yuboring:");
        return true;
      }
      sessions[chatId].regData.phone = text;
      pushState(chatId, 'REG_VILOYAT');
      await clearAndSend(bot, chatId, "📍 Doimiy yashash viloyatingiz/shahringizni kiriting:", backKeyboard);
      break;

    case 'REG_VILOYAT':
      sessions[chatId].regData.viloyat = text;
      pushState(chatId, 'REG_FILIAL');

      // Filial tugmalarini dinamik shakllantirish
      const filialButtons = (db.filiallar || []).map(f => [{ text: f }]);
      filialButtons.push([{ text: "⬅️ Ortga qaytish" }]);

      await clearAndSend(bot, chatId, "🏢 O'zingiz yashayotgan HOSTEL filialini tanlang:", { keyboard: filialButtons, resize_keyboard: true });
      break;

    case 'REG_FILIAL':
      if (!db.filiallar.includes(text)) {
        await bot.sendMessage(chatId, "⚠️ Ro'yxatdagi filiallardan birini tanlang:");
        return true;
      }
      sessions[chatId].regData.filial = text;
      pushState(chatId, 'REG_XONA');
      await clearAndSend(bot, chatId, "🚪 Yashayotgan xona raqamingizni kiriting:", backKeyboard);
      break;

    case 'REG_XONA':
      sessions[chatId].regData.xona = text;
      pushState(chatId, 'REG_YOTOQ');
      await clearAndSend(bot, chatId, "🛏️ Yotoq joyingiz (Koyka) raqami yoki nomini kiriting:", backKeyboard);
      break;

    case 'REG_YOTOQ':
      sessions[chatId].regData.yotoq = text;
      pushState(chatId, 'REG_MUDDATI');
      await clearAndSend(bot, chatId, "📅 Ijara muddati tugash sanasini kiriting (Masalan: DD.MM.YYYY):\n<i>Bu sana orqali tizim sizni avtomatik ogohlantiradi.</i>", backKeyboard);
      break;

    case 'REG_MUDDATI':
      const dateRegex2 = /^\d{2}\.\d{2}\.\d{4}$/;
      if (!dateRegex2.test(text)) {
        await bot.sendMessage(chatId, "⚠️ Noto'g'ri sana formati! Iltimos, DD.MM.YYYY ko'rinishida yuboring:");
        return true;
      }
      sessions[chatId].regData.muddati = text;
      sessions[chatId].regData.status = "verify_pending"; // Tekshiruvda

      // Kelajakdagi callback uchun ma'lumotni tayyorlab saqlaymiz
      pushState(chatId, 'REG_CONFIRM_WAIT');
      
      // Barcha ma'lumotlarni yig'ib ariza ko'rinishida chiqarish (buni keyingi modulda guruhga yuboramiz)
      await clearAndSend(bot, chatId, "✅ Ma'lumotlaringiz muvaffaqiyatli qabul qilindi va tekshirish uchun ma'muriyatga yuborildi. Iltimos, administrator tasdiqlashini kuting... 🕰", mainKeyboard);
      
      // Tashqi funksiyani (arizani adminga/guruhga yuborishni) trigger qilish uchun sessionga belgi qo'yamiz
      sessions[chatId].registrationFinished = true;
      saveSessions();
      break;
  }

  saveSessions();
  return true;
}

// Ortga qaytish tugmasi bosilgandagi interfeys harakati
async function rollbackRegistrationStep(bot, chatId, prevState, sessions) {
  switch (prevState) {
    case 'MAIN_MENU':
      await clearAndSend(bot, chatId, "🏨 Bosh menyuga qaytdingiz. Ro'yxatdan o'tish bekor qilindi.", mainKeyboard);
      break;
    case 'REG_NAME':
      await clearAndSend(bot, chatId, "👤 To'liq F.I.SH (Familiya Ism Sharif) kiriting:", mainKeyboard);
      break;
    case 'REG_BIRTH':
      await clearAndSend(bot, chatId, "📅 Tug'ilgan sanangizni kiriting (Masalan: DD.MM.YYYY):", backKeyboard);
      break;
    case 'REG_PASSPORT':
      await clearAndSend(bot, chatId, "🪪 Pasport seriyasi va raqamini kiriting:", backKeyboard);
      break;
    case 'REG_JSHSHIR':
      await clearAndSend(bot, chatId, "🆔 Pasportingizdagi 14 xonali JSHSHIR (ПИНФЛ) kodini kiriting:", backKeyboard);
      break;
    case 'REG_PHONE':
      await clearAndSend(bot, chatId, "📞 Telefon raqamingizni kiriting:", backKeyboard);
      break;
    case 'REG_VILOYAT':
      await clearAndSend(bot, chatId, "📍 Doimiy yashash viloyatingiz/shahringizni kiriting:", backKeyboard);
      break;
    case 'REG_FILIAL':
      await clearAndSend(bot, chatId, "🏢 O'zingiz yashayotgan HOSTEL filialini tanlang:", backKeyboard);
      break;
    case 'REG_XONA':
      await clearAndSend(bot, chatId, "🚪 Yashayotgan xona raqamingizni kiriting:", backKeyboard);
      break;
    case 'REG_YOTOQ':
      await clearAndSend(bot, chatId, "🛏️ Yotoq joyingiz (Koyka) raqami yoki nomini kiriting:", backKeyboard);
      break;
  }
}

module.exports = { handleRegistration };
                         
