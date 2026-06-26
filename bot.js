// TINCHLIK HOSTEL BOT - MAIN ENTRANCE (INDEX.JS)
const Express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// 1. Konfiguratsiyalarni yuklash
const { db } = require('./config/db');
const { sessions } = require('./config/sessions');

// 2. Klaviaturalarni yuklash
const keyboardsModule = require('./keyboards/keyboards');
const adminKeyboard = keyboardsModule.adminKeyboard;

// 3. Handlerlarni (Ishlov beruvchilarni) ulash
const { handleAdminMenu, handleAdminStates } = require('./handlers/adminMenuHandler');
const { handleAdminStates: handleStatesLogic } = require('./handlers/adminStatesHandler');
const { handleMultimedia } = require('./handlers/multimediaHandler');
const { handleCallbackQuery, startCronValidationRobot } = require('./handlers/callbackHandler');

// ------------------- WEB SERVER (ALIVE GUARD) -------------------
const app = Express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Tinchlik Hostel CRM Bot Muvaffaqiyatli Ishlamoqda! 🚀'));
app.listen(PORT, () => console.log(`[SERVER] Web-server ${PORT}-portda faol.`));

// ------------------- BOT INITIALIZATION -------------------
const TOKEN = '8949142604:AAGqrksBXzXZqOiBPIP0EWLHFJPpSX9Tlmk'; // Sizning tokeningiz
const MAIN_SUPER_ADMIN = 8485164743; // Asosiy admin ID

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('[BOT] Telegram Bot tizimi muvaffaqiyatli start oldi...');

// Dynamic Admin klaviaturasi (Asosiy admin va yordamchilar uchun)
const adminMainKeyboard = adminKeyboard(MAIN_SUPER_ADMIN, db);

// ------------------- CRON ROBOTNI ISHGA TUSHIRISH -------------------
// 3 mahal va muddatlarni avtomatik tekshiruvchi robotni faollashtiramiz
startCronValidationRobot(bot, db, sessions);

// ------------------- MAIN MESSAGE HANDLER -------------------
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Guruhlardan keladigan xabarlarga e'tibor bermaslik (faqat shaxsiy chat uchun)
  if (msg.chat.type !== 'private') return;

  // Seansni tekshirish yoki yangi ochish
  if (!sessions[chatId]) {
    sessions[chatId] = { state: 'START', history: [] };
  }

  const userState = sessions[chatId].state;

  // 1. Agar xabarda rasm yoki fayl bo'lsa, Multimedia handlerga yo'naltirish
  if (msg.photo || msg.document) {
    return handleMultimedia(bot, msg, db, sessions, adminMainKeyboard, MAIN_SUPER_ADMIN);
  }

  if (!text) return;

  // 2. Global /start buyrug'i kelganda
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(chatId, "👋 Tinchlik Hostel botiga xush kelibsiz!\n\n🤖 Bu bot orqali kvartira va kvartirantlar hisobini onlayn kuzatib borishingiz mumkin.", {
    reply_markup: mainKeyboard // Fayllar strukturangizdagi kvartirantKeyboard obyektiga bog'langan
  });
});
  
      // Oddiy foydalanuvchilar (Kvartirantlar) uchun bosh menyu
      bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Foydalanuvchi asosiy admin ekanligini tekshiramiz
  if (userId === MAIN_SUPER_ADMIN) {
    await bot.sendMessage(chatId, "👋 Xush kelibsiz, Hurmatli Tinchlik Hostel Administratori!\n⚙️ Quyidagi menyu orqali tizimni boshqarishingiz mumkin:", {
      reply_markup: adminKeyboard(MAIN_SUPER_ADMIN, db) // Admin funksional tugmalarini biriktiramiz
    });
  } else {
    // Agar oddiy foydalanuvchi /admin buyrug'ini yozsa
    await bot.sendMessage(chatId, "⚠️ Kechirasiz, bu buyruq faqat administratorlar uchun ochiq.");
  }
});
  
  // 3. Admin Menyusi tugmalari bosilganda (Oddiy matnli buyruqlar)
  const adminButtons = [
    "📊 Umumiy Statistika", "🏢 Viloyat/Filial Sozlamalari", 
    "➕ Yangi Viloyat", "➕ Yangi Filial", "🛏 Xona & Yotoq Qo'shish",
    "⚙️ Bot Sozlamalari", "👑 Adminlar Boshqaruvi", "➕ Yangi Admin Qo'shish",
    "📝 Guruh Sozlamalari", "💰 Narxni Sozlash", "🔙 Orqaga"
  ];

  if (adminButtons.includes(text) && (chatId === MAIN_SUPER_ADMIN || db.admins?.[chatId])) {
    return handleAdminMenu(bot, msg, db, sessions, adminMainKeyboard, MAIN_SUPER_ADMIN);
  }

  // 4. State rejimida bo'lsa (Input kutilayotgan jarayonlar: ism yozish, rasm yuborish va h.k.)
  if (userState && userState !== 'START' && userState !== 'ADMIN_MAIN') {
    return handleStatesLogic(bot, msg, db, sessions, adminMainKeyboard, MAIN_SUPER_ADMIN);
  }

  // 5. Agar hech qaysi shartga tushmasa (Kvartirantlar menyu tugmalari bo'lsa)
  // Bu qism handles/adminStatesHandler yoki alohida kvartirant handleriga o'tishi mumkin
  return handleStatesLogic(bot, msg, db, sessions, adminMainKeyboard, MAIN_SUPER_ADMIN);
});

// ------------------- CALLBACK QUERY HANDLER -------------------
bot.on('callback_query', async (query) => {
  await handleCallbackQuery(bot, query, db, sessions, adminMainKeyboard);
  // Telegram callback_query yuklanishini yopish
  try { await bot.answerCallbackQuery(query.id); } catch(e){}
});

// ------------------- XATOLIKLARNI USHLASH (ANTI-CRASH) -------------------
process.on('uncaughtException', (err) => {
  console.error('⚠️ Jiddiy xatolik (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Va\'da bajarilmadi (Unhandled Rejection):', reason);
});

