// Oddiy foydalanuvchilar va kvartirantlar menyu tugmalarini qayta ishlovchi modul
const { pushState } = require('../config/sessions');
const { clearAndSend } = require('../utils/interface');
const { backKeyboard, paymentTypeKeyboard } = require('../keyboards/keyboards');
const { generateAnketaText } = require('../utils/helpers');

async function handleUserMenu(bot, msg, db, sessions) {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Guruh xabarlarini shaxsiy menyuga aralashtirmaymiz
  if (chatId < 0) return false;

  // 1. RO'YXATDAN O'TISHNI BOSHLASH
  if (text === "👤 Roʻyxatdan oʻtish") {
    if (db.kvartirantlar && db.kvartirantlar[chatId]) {
      await bot.sendMessage(chatId, "⚠️ Siz allaqachon ro'yxatdan o'tgansiz yoki arizangiz mavjud!");
      return true;
    }
    sessions[chatId] = { state: 'REG_NAME', history: ['MAIN_MENU', 'REG_NAME'], lastMessageIds: sessions[chatId]?.lastMessageIds || [] };
    await clearAndSend(bot, chatId, "👤 To'liq F.I.SH (Familiya Ism Sharif) kiriting:\n<i>Masalan: Qodirov Olimbek Baxtiyor o'g'li</i>", backKeyboard);
    return true;
  }

  // 2. HOSTEL BILAN TANISHISH VA QOIDALAR
  if (text === "🏨 HOSTEL bilan tanishish") {
    await bot.sendMessage(chatId, "🏨 <b>Tinchlik HOSTEL</b> — shinam, toza va barcha qulayliklarga ega zamonaviy turar-joy majmuasi.\n\n📍 Bizda: 24/7 kuzatuv, bepul Wi-Fi, barcha jihozlangan oshxona va yuvinish xonalari mavjud.");
    return true;
  }

  if (text === "📑 HOSTEL Qoidalar") {
    await bot.sendMessage(chatId, "📑 <b>HOSTEL ICHKI TARTIB QOIDALARI:</b>\n\n1. Hostel hududida tozalikka qat'iy rioya qilinadi.\n2. Kechki soat 23:00 dan keyin tinchlik saqlanishi shart.\n3. To'lovlar o'z vaqtida, kechiktirilmasdan amalga oshirilishi lozim.");
    return true;
  }

  // 3. KVARTIRANTLAR UCHUN: MENING PROFILIM
  if (text === "📋 Mening profilim") {
    if (db.kvartirantlar && db.kvartirantlar[chatId]) {
      const profilText = generateAnketaText(chatId, db, sessions);
      await bot.sendMessage(chatId, profilText, { parse_mode: 'HTML' });
    } else {
      await bot.sendMessage(chatId, "⚠️ Profilingiz topilmadi. Iltimos, avval ro'yxatdan o'ting.");
    }
    return true;
  }

  // 4. KVARTIRANTLAR UCHUN: TO'LOV QILISH TIZIMI
  if (text === "💰 Toʻlov qilish") {
    if (!db.kvartirantlar || !db.kvartirantlar[chatId]) {
      await bot.sendMessage(chatId, "⚠️ Siz hali kvartirant sifatida tasdiqlanmagansiz!");
      return true;
    }
    pushState(chatId, 'PAY_TYPE');
    await clearAndSend(bot, chatId, "💳 To'lov turini tanlang:", paymentTypeKeyboard);
    return true;
  }

  // 5. ADMINGA MUROJAAT YUBORISH
  if (text === "✍️ Adminga murojaat") {
    pushState(chatId, 'INPUT_MUROJAAT');
    await clearAndSend(bot, chatId, "✍️ Adminga yubormoqchi bo'lgan murojaatingiz matnini yoki shikoyatingizni batafsil yozib yuboring:", backKeyboard);
    return true;
  }

  return false; // Agar foydalanuvchi tugma bosmagan, oddiy matn yozgan bo'lsa
}

module.exports = { handleUserMenu };
                       
