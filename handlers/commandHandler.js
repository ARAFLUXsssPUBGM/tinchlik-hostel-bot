// /start va /admin buyruqlarini qayta ishlovchi modul
const { pushState } = require('../config/sessions');
const { clearAndSend } = require('../utils/interface');
const { mainKeyboard, kvartirantKeyboard, adminMainKeyboard } = require('../keyboards/keyboards');

function handleCommands(bot, msg, db, sessions) {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Guruhlardan kelgan buyruqlarni shaxsiy chat logikasiga aralashtirmaymiz
  if (chatId < 0) return false; 

  // /start buyrug'i
  if (text === '/start') {
    sessions[chatId] = { state: 'MAIN_MENU', history: ['MAIN_MENU'], lastMessageIds: sessions[chatId]?.lastMessageIds || [] };
    
    // Foydalanuvchi statusini tekshirish
    const kvartirant = db.kvartirantlar[chatId];
    if (kvartirant && kvartirant.status === 'aktiv') {
      clearAndSend(bot, chatId, "✨ Xush kelibsiz! Tinchlik Hostel tizimiga kvartirant sifatida kirdingiz.", kvartirantKeyboard);
    } else {
      clearAndSend(bot, chatId, "🏨 Tinchlik Hostel botiga xush kelibsiz!\n\nIltimos, bot imkoniyatlaridan foydalanish uchun ro'yxatdan o'ting yoki menyuni tanlang.", mainKeyboard);
    }
    return true;
  }

  // /admin buyrug'i
  if (text === '/admin') {
    if (db.admins.includes(chatId)) {
      pushState(chatId, 'ADMIN_MAIN');
      clearAndSend(bot, chatId, "👨‍✈️ Admin paneliga xush kelibsiz. Kerakli bo'limni tanlang:", adminMainKeyboard);
    } else {
      clearAndSend(bot, chatId, "⛔ Kechirasiz, siz tizim admini emassiz.");
    }
    return true;
  }

  return false; // Agar hech qaysi buyruqqa tushmasa, keyingi handlerlarga o'tkaziladi
}

module.exports = { handleCommands };
