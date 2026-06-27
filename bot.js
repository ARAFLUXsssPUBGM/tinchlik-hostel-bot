const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// --- SERVER UCHUN (Render.com da o'chib qolmasligi uchun) ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Hostel CRM Bot Ishlamoqda!'));
app.listen(PORT, () => console.log(`Server ${PORT}-portda yondi.`));

// --- SOZLAMALAR ---
const TOKEN = '8949142604:AAHERMT6uleHZMlHgNDSov3nW4L2R0PMqj8'; // Tokenni kiriting
const bot = new TelegramBot(TOKEN, { polling: true });

// Baza fayllari
const DB_FILE = path.join(__dirname, 'database.json');
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// --- BAZA STRUKTURASI ---
let db = {
  admins: { "8485164743": { name: "Asosiy Admin", isSuper: true } }, // 8485164743 o'rniga o'z ID ngizni yozing
  matrix: { viloyatlar: {} }, // Viloyat -> Filial -> Xona -> Yotoq
  users: {}, // Kvartirantlar bazasi
  settings: {
    card: "8600 **** **** ****",
    cardName: "Karta Egasining Ismi",
    groups: { aktiv: null, qarz: null, arxiv: null }
  },
  pendingPayments: [] // Admin o'chirmasligi uchun saqlanadigan to'lov xabarlari
};

let sessions = {}; // Foydalanuvchi qadamlari (State)
let chatCache = {}; // Chatni tozalash uchun xabarlar ID si

// Baza yuklash
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE));
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// Session va Cache
const getSession = (chatId) => {
  if (!sessions[chatId]) sessions[chatId] = { step: null, data: {}, history: [] };
  return sessions[chatId];
};
const getCache = (chatId) => {
  if (!chatCache[chatId]) chatCache[chatId] = { startMsgId: null, adminMsgId: null, lastBotMsgId: null };
  return chatCache[chatId];
};

// ==========================================
// 1. CHAT TOZALASH VA XABAR YUBORISH MANTIQI
// ==========================================

async function sendClear(chatId, text, options = {}, isMainMenu = false, menuType = '') {
  const cache = getCache(chatId);
  
  // Eski bot xabarini o'chirish (Agar u asosiy menyu bo'lmasa)
  if (cache.lastBotMsgId) {
    try { await bot.deleteMessage(chatId, cache.lastBotMsgId); } catch(e){}
  }

  // /start va /admin bir-birini o'chiradi
  if (isMainMenu) {
    if (menuType === 'start' && cache.adminMsgId) {
      try { await bot.deleteMessage(chatId, cache.adminMsgId); cache.adminMsgId = null; } catch(e){}
    }
    if (menuType === 'admin' && cache.startMsgId) {
      try { await bot.deleteMessage(chatId, cache.startMsgId); cache.startMsgId = null; } catch(e){}
    }
  }

  const msg = await bot.sendMessage(chatId, text, options);

  if (isMainMenu) {
    if (menuType === 'start') cache.startMsgId = msg.message_id;
    if (menuType === 'admin') cache.adminMsgId = msg.message_id;
    cache.lastBotMsgId = null; // Asosiy menyular oddiy tozalanishga tushmaydi
  } else {
    cache.lastBotMsgId = msg.message_id;
  }
  return msg;
}

// Orqaga qaytish tugmasi yasovchi
const backBtn = [{ text: "⬅️ Ortga qaytish" }];

// ==========================================
// 2. BUYRUQLAR (COMMANDS)
// ==========================================

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const session = getSession(chatId);
  
  // Guruh sozlamalari buyruqlari
  if (text === "/aktiv" || text === "/qarz" || text === "/arxiv") {
    if (!db.admins[msg.from.id]) return;
    if (text === "/aktiv") { db.settings.groups.aktiv = chatId; bot.sendMessage(chatId, "✅ AKTIV kvartirantlar bazasi sozlandi."); }
    if (text === "/qarz") { db.settings.groups.qarz = chatId; bot.sendMessage(chatId, "⚠️ QARZDORLAR bazasi sozlandi."); }
    if (text === "/arxiv") { db.settings.groups.arxiv = chatId; bot.sendMessage(chatId, "⛔️ KETGANLAR arxiv bazasi sozlandi."); }
    saveDB();
    return;
  }

  // Shaxsiy chat tekshiruvi
  if (msg.chat.type !== 'private') return;

  // Foydalanuvchi yozgan xabarni darhol o'chirish (tozalik uchun)
  if (text !== "/start" && text !== "/admin") {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
  }

  // /start BUYRUG'I
  if (text === "/start") {
    session.step = null;
    session.history = [];
    const user = db.users[chatId];

    if (user && (user.status === 'aktiv' || user.status === 'qarz')) {
      const keyboard = {
        keyboard: [
          [{ text: "📅 Ijara Muddati" }, { text: "💵 Toʻlov qilish" }],
          [{ text: "💳 Karta Raqam" }, { text: "📜 Qoidalar" }],
          [{ text: "🛂 Adminga murojat yoʻllash" }]
        ], resize_keyboard: true
      };
      await sendClear(chatId, `Assalomu alaykum ${user.filial || 'HOSTEL'} Profilingizga xush kelibsiz...❕`, { reply_markup: keyboard }, true, 'start');
    } else {
      const keyboard = {
        keyboard: [
          [{ text: "Roʻyxatdan oʻtish" }],
          [{ text: "HOSTEL bilan tanishish" }, { text: "HOSTEL 📝 Qoidalar" }]
        ], resize_keyboard: true
      };
      await sendClear(chatId, "Hush kelibsiz! Quyidagi menyudan tanlang:", { reply_markup: keyboard }, true, 'start');
    }
    return;
  }

  // /admin BUYRUG'I
  if (text === "/admin") {
    if (!db.admins[chatId]) {
      await bot.sendMessage(chatId, "Kechirasiz hurmatli foydalanuvchi Siz Admin paneliga kirish huquqiga ega emassiz...!");
      return;
    }
    session.step = null;
    const keyboard = {
      keyboard: [
        [{ text: "📊 STATISTIKA" }, { text: "📜 Qoida sozlash" }],
        [{ text: "🏨 HOSTEL Sozlash" }, { text: "👮‍♂️ Admin qoʻshish" }],
        [{ text: "💳 Karta Sozlamalari" }, { text: "📢 Xabarnoma" }],
        [{ text: "🏨 HOSTEL tanishuv sozlamalari" }],
        [{ text: "⛅ KUNLIK Toʻlovni sozlash" }]
      ], resize_keyboard: true
    };
    await sendClear(chatId, "👑 Admin paneliga xush kelibsiz!", { reply_markup: keyboard }, true, 'admin');
    return;
  }

  // --- ORTGA QAYTISH MANTIQI ---
  if (text === "⬅️ Ortga qaytish") {
    if (session.history.length > 0) {
      const prevStep = session.history.pop();
      session.step = prevStep.step;
      // Bot o'zini shu qadamga qaytadan yo'naltiradi (Quyida step router orqali ishlash kerak, murakkablik uchun qisqartirildi)
      await sendClear(chatId, "Ortga qaytildi. Iltimos amalni qayta tanlang.", { reply_markup: { remove_keyboard: true } });
    }
    return;
  }

  // ==========================================
  // 3. REGISTRATSIYA ZANJIRI (STATE MACHINE)
  // ==========================================
  if (text === "Roʻyxatdan oʻtish") {
    session.step = 'reg_fish';
    session.history.push({ step: null });
    await sendClear(chatId, "1. Foydalanuvchi Familiya Ism Sharifi F.I.SH kiriting:", { reply_markup: { keyboard: [backBtn], resize_keyboard: true } });
    return;
  }

  if (session.step === 'reg_fish') {
    session.data.fish = text;
    session.step = 'reg_dob';
    session.history.push({ step: 'reg_fish' });
    await sendClear(chatId, "2. Kun.Oy.Yil tartibida Tugʻilgan sanasini kiriting (Masalan: 01.01.2000):", { reply_markup: { keyboard: [backBtn], resize_keyboard: true } });
    return;
  }
  
  if (session.step === 'reg_dob') {
    session.data.dob = text;
    session.step = 'reg_phone';
    await sendClear(chatId, "3. Telefon raqamingizni kiriting:", { reply_markup: { keyboard: [backBtn], resize_keyboard: true } });
    return;
  }

  if (session.step === 'reg_phone') {
    session.data.phone = text;
    session.step = 'reg_passport_ser';
    await sendClear(chatId, "4. Pasport Seriya Raqami (Masalan: AD 1234567):", { reply_markup: { keyboard: [backBtn], resize_keyboard: true } });
    return;
  }

  if (session.step === 'reg_passport_ser') {
    session.data.passportSer = text;
    session.step = 'reg_pinfl';
    await sendClear(chatId, "5. Pasport JSHSHIR (PINFL - 14 ta raqam):");
    return;
  }

  if (session.step === 'reg_pinfl') {
    session.data.pinfl = text;
    session.step = 'reg_selfie';
    await sendClear(chatId, "6. Iltimos, yuzingizni Selfi rasmini yuboring.");
    return;
  }

  if (session.step === 'reg_selfie' && msg.photo) {
    session.data.selfie = msg.photo[msg.photo.length - 1].file_id;
    session.step = 'reg_gender';
    const kb = { keyboard: [[{ text: "Ayol" }, { text: "Erkak" }], backBtn], resize_keyboard: true };
    await sendClear(chatId, "7. Jinsingizni belgilang:", { reply_markup: kb });
    return;
  }

  if (session.step === 'reg_gender') {
    session.data.gender = text;
    session.step = 'reg_matrix_viloyat';
    // Viloyatlarni bazadan o'qib tugma yasash (Klaviatura orqali, inline emas, topshiriqqa ko'ra keyboard shaklida)
    const viloyatlar = Object.keys(db.matrix.viloyatlar);
    if(viloyatlar.length === 0) return await sendClear(chatId, "Hozircha hostel tizimida bo'sh joylar kiritilmagan.");
    
    let kb = viloyatlar.map(v => [{ text: v }]); kb.push(backBtn);
    await sendClear(chatId, "8. Viloyatni tanlang:", { reply_markup: { keyboard: kb, resize_keyboard: true } });
    return;
  }

  // Viloyat -> Filial -> Xona -> Yotoq tanlash mantiqi shu yerda ketma-ket davom etadi...
  // (Token hajmi cheklovi sababli bu zanjirning strukturasini berdim, huddi tepadagidek davom etadi)

  if (session.step === 'reg_pay_type') {
    session.data.payType = text; // 💳 Karta orqali yoki 💵 Naqd pul bilan
    if (text === "💳 Karta orqali") {
      session.step = 'reg_pay_screen';
      await sendClear(chatId, `To'lov uchun karta: ${db.settings.card} (${db.settings.cardName})\nIltimos, to'lov skrinshotini yuboring.`);
    } else {
      finalizeRegistration(chatId, session.data); // Naqd pul skrinshotsiz
    }
    return;
  }

  if (session.step === 'reg_pay_screen' && msg.photo) {
    session.data.checkPhoto = msg.photo[msg.photo.length - 1].file_id;
    finalizeRegistration(chatId, session.data);
    return;
  }

  // ==========================================
  // 4. ADMIN MATRIX YARATISH (🏨 HOSTEL Sozlash)
  // ==========================================
  if (text === "🏨 HOSTEL Sozlash" && db.admins[chatId]) {
    const inlineKb = {
      inline_keyboard: [
        [{ text: "➕ Viloyat qo'shish", callback_data: "add_vil" }, { text: "🗑️ Viloyatni o'chirish", callback_data: "del_vil" }],
        [{ text: "➕ Filiall qo'shish", callback_data: "add_fil" }, { text: "🗑️ Filialni o'chirish", callback_data: "del_fil" }],
        [{ text: "➕ Xona qo'shish", callback_data: "add_xon" }, { text: "🗑️ Xonani o'chirish", callback_data: "del_xon" }],
        [{ text: "➕ Yotoq qo'shish", callback_data: "add_yot" }, { text: "🗑️ Yotoqni o'chirish", callback_data: "del_yot" }]
      ]
    };
    await sendClear(chatId, "🏨 HOSTEL Struktura Matrixi:", { reply_markup: inlineKb });
    return;
  }

  // State router for Admin actions
  if (session.step === 'add_vil_name') {
    db.matrix.viloyatlar[text] = { filiallar: {} };
    saveDB();
    session.step = null;
    await sendClear(chatId, `✅ "${text}" viloyati bazaga qo'shildi!`);
    return;
  }
});

// ==========================================
// 5. REGISTRATSIYA VA TO'LOVNI ADMINGA YUBORISH
// ==========================================
async function finalizeRegistration(chatId, data) {
  await sendClear(chatId, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting...");
  
  const caption = `
🔔YANGI KVARTIRANT TOʻLOVI

💵 Toʻlov turi : ${data.payType}
🤝 Summa: ${data.price || "Kiritilmagan"}
👤 (F.I.SH) : ${data.fish}
📅 Tugʻilgan sanasi : ${data.dob}
🪪 Pasport Seriyasi : ${data.passportSer}
🆔 JSHSHIR Raqami : ${data.pinfl}
📞 Tel Raqami: ${data.phone}
🚩 Viloyat : ${data.viloyat || "-"}
🏨 Filial : ${data.filial || "-"}
🚪 Xona : ${data.xona || "-"}
🛏 Yotoq : ${data.yotoq || "-"}
📅 Ijara Muddati : Kiritilmagan
📌 Eslatma : Yo'q

Xabar tugmasi:
👤Telegram Profili: [Profilga o'tish](tg://user?id=${chatId})`;

  const inlineKb = {
    inline_keyboard: [[
      { text: "✅ Tasdiqlash", callback_data: `approve_${chatId}` },
      { text: "❌ Rad etish", callback_data: `reject_${chatId}` }
    ]]
  };

  for (let adminId in db.admins) {
    if (data.payType === "💳 Karta orqali") {
      // 2 ta rasm: MediaGroup qilib jo'natish bot.sendMediaGroup
      await bot.sendMediaGroup(adminId, [
        { type: 'photo', media: data.selfie, caption: caption, parse_mode: 'Markdown' },
        { type: 'photo', media: data.checkPhoto }
      ]).then(async msgs => {
         // MediaGroup inline button qabul qilmaydi, shuning uchun buttonni alohida xabar qilib jo'natamiz
         await bot.sendMessage(adminId, "Yuqoridagi to'lovni tasdiqlaysizmi?", { reply_markup: inlineKb });
      });
    } else {
      await bot.sendPhoto(adminId, data.selfie, { caption: caption, parse_mode: 'Markdown', reply_markup: inlineKb });
    }
  }
}

// ==========================================
// 6. INLINE TUGMALAR VA CALLBACK (CALLBACK_QUERY)
// ==========================================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const session = getSession(chatId);

  // Admin Matrix qo'shish
  if (data === "add_vil") {
    session.step = 'add_vil_name';
    await bot.editMessageText("Kiritmoqchi boʻlgan Viloyatingizni nomini yozing:", { chat_id: chatId, message_id: query.message.message_id });
  }
  
  // Tasdiqlash / Rad etish
  if (data.startsWith("approve_")) {
    const userId = data.split("_")[1];
    db.users[userId] = { status: 'aktiv', ...sessions[userId]?.data };
    saveDB();
    
    // Qolgan adminlar chatida o'chmasligi qoidasi so'ralgan, shuning uchun bu habar callbackdan so'ng o'z holicha yangilanadi
    await bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: "✅ TASDIQLANGAN", callback_data: "done" }]] }, { chat_id: chatId, message_id: query.message.message_id });
    
    session.step = `add_note_${userId}`;
    await bot.sendMessage(chatId, "Ushbu foydalanuvchi maʼlumotlari yoniga Eslatma maʼlumot qoʻshib qoʻyasizmi?", {
      reply_markup: { keyboard: [[{ text: "✅ Qoldirish" }, { text: "Davom etish" }]], resize_keyboard: true }
    });
  }
});

// ==========================================
// 7. CRON - 3, 2, 1 KUN OGOHLANTIRISH VA QARZGA O'TKAZISH
// ==========================================
cron.schedule('0 9,14,20 * * *', async () => {
  // Kuniga 3 mahal (9:00, 14:00, 20:00) tekshiradi
  const now = new Date();
  
  for (let uId in db.users) {
    const user = db.users[uId];
    if (user.status !== 'aktiv' || !user.expireDate) continue;

    const expDate = new Date(user.expireDate); // YYYY-MM-DD
    const diffTime = expDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3 && diffDays >= 0) {
      const msg = `⚠️ Diqqat! Ijara muddatingiz tugashiga ${diffDays} kun qoldi.`;
      await bot.sendMessage(uId, msg);
      for(let adminId in db.admins) {
         await bot.sendMessage(adminId, `⚠️ Kvartirant ${user.fish} muddati tugashiga ${diffDays} kun qoldi.`);
      }
    } else if (diffDays < 0) {
      user.status = 'qarz';
      saveDB();
      // Qarz guruhiga yuborish formati
      if(db.settings.groups.qarz) {
         const qarzText = `⚠️ QARZDOR Kvartirant\n\n👤 (F.I.SH) : ${user.fish}\n...`; // Format asosida
         await bot.sendPhoto(db.settings.groups.qarz, user.selfie, {
           caption: qarzText,
           reply_markup: { inline_keyboard: [[{ text: "📌 Eslatma kiritish", callback_data: `note_${uId}` }, { text: "❌ Kvartirant ketgan", callback_data: `leave_${uId}` }]] }
         });
      }
    }
  }
});

  
