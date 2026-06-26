// Guruhlar va admin paneldagi inline tugmalardan keladigan so'rovlarni qayta ishlash
const { saveDB } = require('../config/database');
const { pushState } = require('../config/sessions');
const { updateKvartirantInGroup } = require('../utils/groupNotifier');
const { generateAnketaText } = require('../utils/helpers');

async function handleCallbackQueries(bot, callbackQuery, db, sessions) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  // 1. Kvartirant arizasini tasdiqlash
  if (data.startsWith('verify_yes_')) {
    const userId = data.split('_')[2];
    
    // Agar sessionda yoki vaqtinchalik ro'yxatda ma'lumot bo'lsa, bazaga aktiv qilib qo'shamiz
    if (sessions[userId]?.regData) {
      db.kvartirantlar[userId] = {
        ...sessions[userId].regData,
        status: 'aktiv',
        joinedAt: new Date()
      };
    } else if (db.kvartirantlar[userId]) {
      db.kvartirantlar[userId].status = 'aktiv';
    } else {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Arizachi ma'lumotlari topilmadi!", show_alert: true });
      return;
    }

    saveDB();

    // Guruhdagi xabarni yangilash (Tugmalarni olib tashlaymiz)
    const updatedText = generateAnketaText(userId, db, sessions) + `\n\n=== 🟢 ADMIN TOMONIDAN TASDIQLANDI ===`;
    await bot.editMessageText(updatedText, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });
    
    // Foydalanuvchining o'ziga xushxabarni yuborish
    try {
      await bot.sendMessage(userId, "🎉 Tabriklaymiz! Sizning arizangiz administrator tomonidan tasdiqlandi. Endi bot imkoniyatlaridan to'liq foydalanishingiz mumkin.");
    } catch (e) {
      // Foydalanuvchi botni bloklagan bo'lsa xatolik bermasligi uchun
    }

    // Aktiv guruhga ham anketasini chiroyli qilib yuborish
    await updateKvartirantInGroup(bot, userId, db, sessions, "group_active");
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Kvartirant muvaffaqiyatli tasdiqlandi!" });
  }

  // 2. Kvartirant arizasini rad etish
  else if (data.startsWith('verify_no_')) {
    const userId = data.split('_')[2];

    const updatedText = `<b>❌ ARIZA RAD ETILDI</b>\n\nFoydalanuvchi ID: ${userId}`;
    await bot.editMessageText(updatedText, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });

    try {
      await bot.sendMessage(userId, "❌ Afsuski, siz yuborgan ariza administrator tomonidan rad etildi. Ma'lumotlarni qayta tekshirib, to'g'ri kiritishingizni so'raymiz.");
    } catch (e) {}

    if (sessions[userId]) {
      sessions[userId].state = 'MAIN_MENU';
      sessions[userId].regData = null;
    }
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Ariza rad etildi." });
  }

  // 3. To'lovni tasdiqlash
  else if (data.startsWith('pay_yes_')) {
    const parts = data.split('_');
    const userId = parts[2];
    const summa = parseFloat(parts[3]);
    const payType = parts[4];

    if (db.kvartirantlar[userId]) {
      db.kvartirantlar[userId].status = 'aktiv'; // To'lov qilsa status aktivga o'tadi
      
      db.payments.push({
        userId,
        fish: db.kvartirantlar[userId].fish,
        summa,
        payType,
        date: new Date()
      });
      saveDB();
    }

    const updatedText = `<b>✅ TO'LOV TASDIQLANDI</b>\n\nSuma: ${summa} so'm\nUslub: ${payType}\nKvartirant ID: ${userId}`;
    await bot.editMessageText(updatedText, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });

    try {
      await bot.sendMessage(userId, `✅ Siz yuborgan ${summa} so'mlik to'lov ma'muriyat tomonidan tasdiqlandi. Rahmat!`);
    } catch (e) {}

    await bot.answerCallbackQuery(callbackQuery.id, { text: "To'lov muvaffaqiyatli qabul qilindi!" });
  }

  // 4. To'lovni rad etish
  else if (data.startsWith('pay_no_')) {
    const userId = data.split('_')[2];

    const updatedText = `<b>❌ TO'LOV RAD ETILDI</b>\n\nKvartirant ID: ${userId}`;
    await bot.editMessageText(updatedText, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });

    try {
      await bot.sendMessage(userId, "❌ Siz yuborgan to'lov cheki ma'muriyat tomonidan rad etildi. Iltimos, chek to'g'riligini yoki pul o'tganini tekshirib, qayta yuboring.");
    } catch (e) {}

    await bot.answerCallbackQuery(callbackQuery.id, { text: "To'lov arizasi rad etildi." });
  }

  // 5. Guruh ichidan turib kvartirantga eslatma/notalar yozish (Admin trigger)
  else if (data.startsWith('group_note_')) {
    const userId = data.split('_')[2];
    
    // Guruhda tugmani bosgan adminning shaxsiy chatiga o'tishini so'raymiz
    // Chunki eslatma matnini shaxsiyda yozib olish qulay
    pushState(callbackQuery.from.id, `WRITE_NOTE_FOR_${userId}`);
    
    await bot.answerCallbackQuery(callbackQuery.id, { 
      text: "📝 Eslatma yozish uchun botning shaxsiy chatiga (/admin bo'limiga) o'ting!", 
      show_alert: true 
    });
  }

  // 6. Kvartirant hostelni tark etganda arxivga kuzatish
  else if (data.startsWith('group_exit_')) {
    const userId = data.split('_')[2];

    if (db.kvartirantlar[userId]) {
      db.kvartirantlar[userId].status = 'arxiv';
      saveDB();
      
      const updatedText = generateAnketaText(userId, db, sessions) + `\n\n=== ⛔ HOSTELDAN CHIQIB KETDI (ARXIVLANDI) ===`;
      await bot.editMessageText(updatedText, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });

      // Arxiv guruhiga ko'chirish
      await updateKvartirantInGroup(bot, userId, db, sessions, "group_archive");
    }
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Kvartirant arxivga ko'chirildi." });
  }
}

module.exports = { handleCallbackQueries };
      
