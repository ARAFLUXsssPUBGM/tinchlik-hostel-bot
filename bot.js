const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Tinchlik Hostel Bot faol va ishlamoqda!');
});

app.listen(PORT, () => {
  console.log(`Veb-server ${PORT}-portda muvaffaqiyatli tinglamoqda.`);
});

 * TINCHLIK HOSTEL - ADVANCED CRM BOT
 * Kutubxonalar: node-telegram-bot-api, node-cron
 * Fayl nomi: bot.js
 * Tizim: Node.js (GetX mantiqiy analogi asosida state-management qilingan)
 */

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// ------------------- SOZLAMALAR VA TOKEnLAR -------------------
const TOKEN = '8949142604:AAGqrksBXzXZqOiBPIP0EWLHFJPpSX9Tlmk';
const MAIN_SUPER_ADMIN = 8485164743; // Sizning Chat ID

const bot = new TelegramBot(TOKEN, { polling: true });

// ------------------- BAZA STRUKTURASI -------------------
const DB_FILE = path.join(__dirname, 'database.json');
const SESSION_FILE = path.join(__dirname, 'sessions.json');

let db = {
  admins: [MAIN_SUPER_ADMIN],
  superAdmins: [MAIN_SUPER_ADMIN],
  settings: {
    hostel_info: "Hali ma'lumot kiritilmagan",
    hostel_rules: "Hali qoidalar kiritilmagan",
    card_number: "0000 0000 0000 0000",
    card_owner: "Hali mavjud emas",
    daily_price: 50000,
    Aktiv_Guruh: null,
    Qarz_Guruh: null,
    Ketgan_Guruh: null
  },
  hostel_structure: {}, // Viloyat -> Filial -> Xona -> Yotoqlar (narxi bilan)
  kvartirantlar: {}, // user_id -> ma'lumotlar
  archive: [] // Ketganlar tarixi
};

let sessions = {};

// Fayldan yuklash
if (fs.existsSync(DB_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { console.log("Baza o'qishda xato, yangilanmoqda..."); }
}
if (fs.existsSync(SESSION_FILE)) {
  try { sessions = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); } catch (e) { console.log("Sessiya o'qishda xato..."); }
}

function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); }
function saveSessions() { fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf8'); }

// ------------------- YORDAMCHI FUNKSIYALAR -------------------
// Raqamlarni 000 000 ko'rinishida formatlash
function formatMoney(amount) {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " soʻm";
}

// Matndan faqat raqamlarni ajratib olish
function parseMoney(text) {
  return parseInt(text.replace(/\s+/g, ''), 10) || 0;
}

// Sanani Kun.Oy.Yil formatiga keltirish
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Chat tozaligini ta'minlash: Eski xabarlarni o'chirish
async function clearAndSend(chatId, text, replyMarkup) {
  if (sessions[chatId] && sessions[chatId].lastMessageIds) {
    for (let msgId of sessions[chatId].lastMessageIds) {
      try { await bot.deleteMessage(chatId, msgId); } catch (e) {}
    }
    sessions[chatId].lastMessageIds = [];
  } else {
    if (!sessions[chatId]) sessions[chatId] = {};
    sessions[chatId].lastMessageIds = [];
  }

  try {
    const sentMsg = await bot.sendMessage(chatId, text, { reply_markup: replyMarkup, parse_mode: 'HTML' });
    sessions[chatId].lastMessageIds.push(sentMsg.message_id);
    saveSessions();
  } catch (e) {
    console.error("Xabar yuborishda xatolik:", e);
  }
}

// Ortga qaytish mexanizmi uchun state saqlash
function pushState(chatId, state) {
  if (!sessions[chatId]) sessions[chatId] = { history: [], lastMessageIds: [] };
  if (!sessions[chatId].history) sessions[chatId].history = [];
  sessions[chatId].history.push(state);
  sessions[chatId].state = state;
  saveSessions();
}

function popState(chatId) {
  if (!sessions[chatId] || !sessions[chatId].history || sessions[chatId].history.length <= 1) {
    return 'MAIN_MENU';
  }
  sessions[chatId].history.pop(); // Hozirgisi
  const prevState = sessions[chatId].history.pop();
  return prevState || 'MAIN_MENU';
}

// ------------------- KLAVIATURALAR (KEYBOARDS) -------------------
const mainKeyboard = {
  keyboard: [
    [{ text: "👤 Roʻyxatdan oʻtish" }],
    [{ text: "🏨 HOSTEL bilan tanishish" }, { text: "🛂 HOSTEL Qoidalar" }]
  ],
  resize_keyboard: true
};

const kvartirantKeyboard = {
  keyboard: [
    [{ text: "📅 Ijara Muddati" }, { text: "💵 Toʻlov qilish" }],
    [{ text: "💳 Karta Raqam" }, { text: "📜 Qoidalar" }],
    [{ text: "🛂 Adminga murojat yoʻllash" }]
  ],
  resize_keyboard: true
};

const adminMainKeyboard = {
  keyboard: [
    [{ text: "📊 STATISTIKA" }, { text: "📜 Qoida sozlash" }],
    [{ text: "🏨 HOSTEL Sozlash" }, { text: "👮‍♂️ Admin qoʻshish" }],
    [{ text: "💳 Karta Sozlamalari" }, { text: "📢 Xabarnoma" }],
    [{ text: "🏨 HOSTEL tanishuv sozlamalari" }],
    [{ text: "⛅ KUNLIK Toʻlovni sozlash" }],
    [{ text: "⬅️ Ortga qaytish" }]
  ],
  resize_keyboard: true
};

const backKeyboard = {
  keyboard: [[{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

const genderKeyboard = {
  keyboard: [[{ text: "Erkak" }, { text: "Ayol" }], [{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

const paymentTypeKeyboard = {
  keyboard: [[{ text: "💳 Karta orqali" }, { text: "💵 Naqd pul bilan" }], [{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

// ------------------- BOT START BUYRUG'I -------------------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { history: [], lastMessageIds: sessions[chatId]?.lastMessageIds || [] };
  
  // Eski xabarlar ichida /start matnini ham tozalash uchun qat'iy mantiq
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  // Aktiv yoki Qarzdor bazasida borligini tekshirish
  if (db.kvartirantlar[chatId] && (db.kvartirantlar[chatId].status === 'aktiv' || db.kvartirantlar[chatId].status === 'qarz')) {
    const filial = db.kvartirantlar[chatId].filial || "HOSTEL";
    pushState(chatId, 'KVARTIRANT_MENU');
    await clearAndSend(chatId, `Assalomu alaykum <b>${filial}</b> Profilingizga xush kelibsiz...❕`, kvartirantKeyboard);
  } else {
    pushState(chatId, 'MAIN_MENU');
    await clearAndSend(chatId, "<b>Tinchlik HOSTEL</b> tizimiga xush kelibsiz! Quyidagi tugmalardan birini tanlang:", mainKeyboard);
  }
});

// Admin panelga kirish
bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (!db.admins.includes(chatId)) {
    return bot.sendMessage(chatId, "Kechirasiz hurmatli foydalanuvchi Siz Admin paneliga kirish huquqiga ega emassiz...!");
  }

  sessions[chatId] = { history: [], lastMessageIds: sessions[chatId]?.lastMessageIds || [] };
  pushState(chatId, 'ADMIN_MAIN');
  await clearAndSend(chatId, "👑 <b>Admin paneliga xush kelibsiz!</b>\nBarcha tizim boshqaruv elementlari quyida joylashgan:", adminMainKeyboard);
});

// Guruh xonalarini (Omborxonalarni) sozlash buyruqlari
bot.onText(/\/(aktiv|qarz|arxiv)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1];

  if (!db.admins.includes(msg.from.id)) return;

  if (command === "aktiv") {
    db.settings.Aktiv_Guruh = chatId;
    await bot.sendMessage(chatId, "✅ Ushbu guruh AKTIV kvartirantlar bazasi sifatida sozlandi.");
  } else if (command === "qarz") {
    db.settings.Qarz_Guruh = chatId;
    await bot.sendMessage(chatId, "⚠️ Ushbu guruh QARZDORLAR bazasi sifatida sozlandi.");
  } else if (command === "arxiv") {
    db.settings.Ketgan_Guruh = chatId;
    await bot.sendMessage(chatId, "❌ Ushbu guruh KETGAN kvartirantlar arxiviga aylantirildi.");
  }
  saveDB();
});

// ------------------- ASOSIY MATN VA TUGMALAR ISHLOVCHISI -------------------
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;
  if (!sessions[chatId]) sessions[chatId] = { state: 'MAIN_MENU', history: [], lastMessageIds: [] };

  const state = sessions[chatId].state;

  // Global Ortga Qaytish Tugmasi
  if (text === "⬅️ Ortga qaytish") {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const prevState = popState(chatId);
    sessions[chatId].state = prevState;
    saveSessions();
    await handleStateReturn(chatId, prevState);
    return;
  }

  // --- ODDiY FOYDALANUVChI MATNLARI ---
  if (state === 'MAIN_MENU') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    if (text === "👤 Roʻyxatdan oʻtish") {
      pushState(chatId, 'REG_FISH');
      await clearAndSend(chatId, "1. Iltimos, Familiya Ism Sharifingizni (F.I.SH) kiriting:", backKeyboard);
    } else if (text === "🏨 HOSTEL bilan tanishish") {
      pushState(chatId, 'MAIN_MENU');
      await clearAndSend(chatId, `🏨 <b>HOSTEL Haqida:</b>\n\n${db.settings.hostel_info}`, mainKeyboard);
    } else if (text === "🛂 HOSTEL Qoidalar") {
      pushState(chatId, 'MAIN_MENU');
      await clearAndSend(chatId, `🛂 <b>HOSTEL Qoidalari:</b>\n\n${db.settings.hostel_rules}`, mainKeyboard);
    }
    return;
  }

  // --- RO'YXATDAN O'TISH BOSQICHLARI (STATE-MACHINE) ---
  if (state.startsWith('REG_')) {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    
    if (state === 'REG_FISH') {
      sessions[chatId].regData = { fish: text };
      pushState(chatId, 'REG_BIRTHTIME');
      await clearAndSend(chatId, "2. Tugʻilgan sanangizni kiriting\nFormat: (Kun.Oy.Yil, masalan: 25.12.2000):", backKeyboard);
    } 
    else if (state === 'REG_BIRTHTIME') {
      sessions[chatId].regData.birth = text;
      pushState(chatId, 'REG_PHONE');
      await clearAndSend(chatId, "3. Telefon raqamingizni kiriting (masalan: +998901234567):", backKeyboard);
    } 
    else if (state === 'REG_PHONE') {
      sessions[chatId].regData.phone = text;
      pushState(chatId, 'REG_PASSPORT');
      await clearAndSend(chatId, "4. Pasport Seriya va Raqamini kiriting (Masalan: AD1234567):", backKeyboard);
    } 
    else if (state === 'REG_PASSPORT') {
      sessions[chatId].regData.passport = text;
      pushState(chatId, 'REG_JSHSHIR');
      await clearAndSend(chatId, "5. Pasportdagi 14 xonali JSHSHIR raqamingizni kiriting:", backKeyboard);
    } 
    else if (state === 'REG_JSHSHIR') {
      sessions[chatId].regData.jshshir = text;
      pushState(chatId, 'REG_SELFIE');
      await clearAndSend(chatId, "6. Yuzingiz aniq koʻringan Selfi Rasmingizni botga yuboring (Faqat rasm ko'rinishida):", backKeyboard);
    } 
    else if (state === 'REG_GENDER') {
      if (text === "Erkak" || text === "Ayol") {
        sessions[chatId].regData.gender = text;
        // Viloyat tanlashga o'tish
        pushState(chatId, 'REG_CHOOSE_VILOYAT');
        const viloyatlar = Object.keys(db.hostel_structure);
        if (viloyatlar.length === 0) {
          sessions[chatId].state = 'MAIN_MENU';
          return await clearAndSend(chatId, "Hozirda tizimda hech qanday viloyat/filial mavjud emas. Keyinroq urinib ko'ring.", mainKeyboard);
        }
        const kbd = { keyboard: viloyatlar.map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "7. Viloyatni tanlang:", kbd);
      }
    }
    else if (state === 'REG_CHOOSE_VILOYAT') {
      if (db.hostel_structure[text]) {
        sessions[chatId].regData.viloyat = text;
        pushState(chatId, 'REG_CHOOSE_FILIAL');
        const filiallar = Object.keys(db.hostel_structure[text]);
        const kbd = { keyboard: filiallar.map(f => [{ text: f }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Filialni tanlang:", kbd);
      }
    }
    else if (state === 'REG_CHOOSE_FILIAL') {
      const vil = sessions[chatId].regData.viloyat;
      if (db.hostel_structure[vil] && db.hostel_structure[vil][text]) {
        sessions[chatId].regData.filial = text;
        pushState(chatId, 'REG_CHOOSE_XONA');
        const xonalar = Object.keys(db.hostel_structure[vil][text]);
        const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Xonani tanlang:", kbd);
      }
    }
    else if (state === 'REG_CHOOSE_XONA') {
      const vil = sessions[chatId].regData.viloyat;
      const fil = sessions[chatId].regData.filial;
      if (db.hostel_structure[vil] && db.hostel_structure[vil][fil] && db.hostel_structure[vil][fil][text]) {
        sessions[chatId].regData.xona = text;
        pushState(chatId, 'REG_CHOOSE_YOTOQ');
        const yotoqlar = Object.keys(db.hostel_structure[vil][fil][text]);
        const kbd = { keyboard: yotoqlar.map(y => [{ text: y }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Yotoq joyini tanlang:", kbd);
      }
    }
    else if (state === 'REG_CHOOSE_YOTOQ') {
      const vil = sessions[chatId].regData.viloyat;
      const fil = sessions[chatId].regData.filial;
      const xon = sessions[chatId].regData.xona;
      if (db.hostel_structure[vil] && db.hostel_structure[vil][fil] && db.hostel_structure[vil][fil][xon] && db.hostel_structure[vil][fil][xon][text]) {
        sessions[chatId].regData.yotoq = text;
        const oylikNarx = db.hostel_structure[vil][fil][xon][text].price || 0;
        sessions[chatId].regData.pricePerMonth = oylikNarx;

        pushState(chatId, 'REG_CHOOSE_DURATION');
        const durationKbd = {
          keyboard: [
            [{ text: "Oylik Toʻlov" }],
            [{ text: "1 kunlik" }, { text: "2 kunlik" }, { text: "3 kunlik" }],
            [{ text: "4 kunlik" }, { text: "5 kunlik" }, { text: "6 kunlik" }],
            [{ text: "7 kunlik" }, { text: "8 kunlik" }, { text: "9 kunlik" }, { text: "10 kunlik" }],
            [{ text: "⬅️ Ortga qaytish" }]
          ],
          resize_keyboard: true
        };
        await clearAndSend(chatId, `Yotoq joyi narxi: <b>${formatMoney(oylikNarx)} / oyiga</b>. Kunlik universal tarif: <b>${formatMoney(db.settings.daily_price)} / kuniga</b>.\n\nIltimos, ijara muddati va to'lov turini tanlang:`, durationKbd);
      }
    }
    else if (state === 'REG_CHOOSE_DURATION') {
      let durationText = text;
      let totalSum = 0;
      let endDate = new Date();

      if (durationText === "Oylik Toʻlov") {
        totalSum = sessions[chatId].regData.pricePerMonth;
        endDate.setMonth(endDate.getMonth() + 1); // Aynan keyingi oyning mos sanasiga ko'chirish
        sessions[chatId].regData.muddati = formatDate(endDate);
        sessions[chatId].regData.summa = totalSum;
        sessions[chatId].regData.durType = "Oylik";
      } else {
        const kunMatch = durationText.match(/(\d+)/);
        if (kunMatch) {
          const kunlar = parseInt(kunMatch[1], 10);
          totalSum = kunlar * db.settings.daily_price;
          endDate.setDate(endDate.getDate() + kunlar);
          sessions[chatId].regData.muddati = formatDate(endDate);
          sessions[chatId].regData.summa = totalSum;
          sessions[chatId].regData.durType = `${kunlar} kunlik`;
        } else {
          return bot.sendMessage(chatId, "Iltimos tugmalardan foydalaning!");
        }
      }

      pushState(chatId, 'REG_PAYMENT_TYPE');
      await clearAndSend(chatId, `Siz tanladingiz: <b>${sessions[chatId].regData.durType}</b>\nToʻlov summasi: <b>${formatMoney(totalSum)}</b>\nMuddat: <b>${sessions[chatId].regData.muddati}</b>gacha.\n\nToʻlov turini belgilang:`, paymentTypeKeyboard);
    }
    else if (state === 'REG_PAYMENT_TYPE') {
      if (text === "💳 Karta orqali") {
        sessions[chatId].regData.payType = "💳 Karta orqali";
        pushState(chatId, 'REG_SEND_CHEK');
        await clearAndSend(chatId, `💳 <b>Karta orqali to'lov:</b>\n\nKarta raqam: <code>${db.settings.card_number}</code>\nEgasining ismi: <b>${db.settings.card_owner}</b>\n\nTo'lovni amalga oshirib, skrinshot/chek rasmini shu yerga yuklang:`, backKeyboard);
      } else if (text === "💵 Naqd pul bilan") {
        sessions[chatId].regData.payType = "💵 Naqd pul bilan";
        // Naqd pulda skrinshot talab qilinmaydi, darhol adminlarga ketadi
        await sendRequestToAdmins(chatId, false);
        sessions[chatId].state = 'MAIN_MENU';
        saveSessions();
        await clearAndSend(chatId, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting. Pulni naqd topshirganingizdan so'ng profilingiz faollashadi.", mainKeyboard);
      }
    }
    return;
  }

  // --- TINChLIK HOSTEL KVARTIRANTI INTERFEYSI ---
  if (state === 'KVARTIRANT_MENU') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const kv = db.kvartirantlar[chatId];
    if (!kv) {
      sessions[chatId].state = 'MAIN_MENU';
      return await clearAndSend(chatId, "Xatolik! Profil topilmadi.", mainKeyboard);
    }

    if (text === "📅 Ijara Muddati") {
      await clearAndSend(chatId, `📅 <b>Sizning ijara muddatingiz:</b> ${kv.muddati}gacha.`, kvartirantKeyboard);
    } else if (text === "💵 Toʻlov qilish") {
      pushState(chatId, 'KVAR_PAY_DURATION');
      const durationKbd = {
        keyboard: [
          [{ text: "Oylik Toʻlov" }],
          [{ text: "1 kunlik" }, { text: "2 kunlik" }, { text: "3 kunlik" }],
          [{ text: "4 kunlik" }, { text: "5 kunlik" }, { text: "6 kunlik" }],
          [{ text: "7 kunlik" }, { text: "8 kunlik" }, { text: "9 kunlik" }, { text: "10 kunlik" }],
          [{ text: "⬅️ Ortga qaytish" }]
        ],
        resize_keyboard: true
      };
      await clearAndSend(chatId, "Qancha muddat uchun to'lov qilmoqchisiz?", durationKbd);
    } else if (text === "💳 Karta Raqam") {
      await clearAndSend(chatId, `💳 <b>To'lov rekvizitlari:</b>\n\nKarta raqam: <code>${db.settings.card_number}</code>\nEgasining ismi: <b>${db.settings.card_owner}</b>`, kvartirantKeyboard);
    } else if (text === "📜 Qoidalar") {
      await clearAndSend(chatId, `🛂 <b>HOSTEL Qoidalari:</b>\n\n${db.settings.hostel_rules}`, kvartirantKeyboard);
    } else if (text === "🛂 Adminga murojat yoʻllash") {
      pushState(chatId, 'KVAR_SEND_MUROJAAT');
      await clearAndSend(chatId, "Murojaatingiz matnini yozib yuboring (Ixtiyoriy rasm ham biriktirishingiz mumkin):", backKeyboard);
    }
    return;
  }

  if (state === 'KVAR_PAY_DURATION') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const kv = db.kvartirantlar[chatId];
    let totalSum = 0;
    let endDate = new Date();

    if (text === "Oylik Toʻlov") {
      totalSum = kv.pricePerMonth || db.settings.daily_price * 30;
      endDate.setMonth(endDate.getMonth() + 1);
      sessions[chatId].renewData = { durType: "Oylik", summa: totalSum, muddati: formatDate(endDate) };
    } else {
      const kunMatch = text.match(/(\d+)/);
      if (kunMatch) {
        const kunlar = parseInt(kunMatch[1], 10);
        totalSum = kunlar * db.settings.daily_price;
        endDate.setDate(endDate.getDate() + kunlar);
        sessions[chatId].renewData = { durType: `${kunlar} kunlik`, summa: totalSum, muddati: formatDate(endDate) };
      } else {
        return bot.sendMessage(chatId, "Iltimos tugmalardan foydalaning!");
      }
    }

    pushState(chatId, 'KVAR_PAY_TYPE');
    await clearAndSend(chatId, `To'lov summasi: <b>${formatMoney(totalSum)}</b>\nTo'lov turini tanlang:`, paymentTypeKeyboard);
    return;
  }

  if (state === 'KVAR_PAY_TYPE') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    if (text === "💳 Karta orqali") {
      sessions[chatId].renewData.payType = "💳 Karta orqali";
      pushState(chatId, 'KVAR_SEND_CHEK');
      await clearAndSend(chatId, `Karta raqam: <code>${db.settings.card_number}</code>\nEgasining ismi: <b>${db.settings.card_owner}</b>\n\nTo'lov chekini rasm ko'rinishida yuboring:`, backKeyboard);
    } else if (text === "💵 Naqd pul bilan") {
      sessions[chatId].renewData.payType = "💵 Naqd pul bilan";
      await sendRenewRequestToAdmins(chatId, false);
      sessions[chatId].state = 'KVARTIRANT_MENU';
      saveSessions();
      await clearAndSend(chatId, "To'lov so'rovingiz adminga yuborildi. Tasdiqlanishini kuting.", kvartirantKeyboard);
    }
    return;
  }

  // --- ADMIN PANEL BOSQICHLARI ---
  if (db.admins.includes(chatId) && state.startsWith('ADMIN_')) {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

    if (state === 'ADMIN_MAIN') {
      if (text === "📊 STATISTIKA") {
        let aktivlar = 0, erkaklar = 0, ayollar = 0, qarzdorlar = 0, qarzSumma = 0, buOydaKirdi = 0;
        let boshYotoqlar = 0;

        // Stat hisoblash
        Object.values(db.kvartirantlar).forEach(k => {
          if (k.status === 'aktiv') {
            aktivlar++;
            if (k.gender === 'Erkak') erkaklar++;
            if (k.gender === 'Ayol') ayollar++;
          }
          if (k.status === 'qarz') {
            qarzdorlar++;
            qarzSumma += (k.summa || 0);
          }
          if (k.joinDate) {
            const d = new Date(k.joinDate);
            const now = new Date();
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) buOydaKirdi++;
          }
        });

        // Bo'sh joylar
        Object.values(db.hostel_structure).forEach(v => {
          Object.values(v).forEach(f => {
            Object.values(f).forEach(x => {
              Object.values(x).forEach(y => {
                if (y.isFree) boshYotoqlar++;
              });
            });
          });
        });

       const statText = `📊 <b>HOSTEL STATISTIKASI</b>\n\n👥 Aktiv Kvartirantlar: <b>${aktivlar} ta</b>\nErkaklar — <b>${erkaklar}</b>\nAyollar   — <b>${ayollar}</b>\n\n🛏 Boʻsh yotoqlar : <b>${boshYotoqlar} ta</b>\n📉 Qarzdorlar soni: <b>${qarzdorlar} kishi</b>\n💰 Olinmagan qarzlar: <b>${formatMoney(qarzSumma)}</b>\n\n👉👤 Bu Oyda nechta Kvartirant qoʻshildi... — <b>${buOydaKirdi} ta</b>`;
        await clearAndSend(chatId, statText, adminMainKeyboard);
      }
      else if (text === "📜 Qoida sozlash") {
        pushState(chatId, 'ADMIN_SET_RULES');
        await clearAndSend(chatId, `Joriy qoidalar:\n<pre>${db.settings.hostel_rules}</pre>\n\nYangi qoidalarni matn ko'rinishida yozib yuboring:`, backKeyboard);
      }
      else if (text === "🏨 HOSTEL tanishuv sozlamalari") {
        pushState(chatId, 'ADMIN_SET_INFO');
        await clearAndSend(chatId, `Joriy tanishtiruv:\n<pre>${db.settings.hostel_info}</pre>\n\nYangi tanishtiruv matnini kiriting:`, backKeyboard);
      }
      else if (text === "💳 Karta Sozlamalari") {
        pushState(chatId, 'ADMIN_SET_CARD_NUM');
        await clearAndSend(chatId, `Joriy Karta: <code>${db.settings.card_number}</code>\nEgasining ismi: <b>${db.settings.card_owner}</b>\n\nYangi karta raqamini faqat raqamlar bilan yozib yuboring:`, backKeyboard);
      }
      else if (text === "⛅ KUNLIK Toʻlovni sozlash") {
        pushState(chatId, 'ADMIN_SET_DAILY');
        await clearAndSend(chatId, `Joriy universal kunlik narx: <b>${formatMoney(db.settings.daily_price)}</b>\nYangi kunlik narxni faqat raqamlarda yozib yuboring (Masalan: 50000):`, backKeyboard);
      }
      else if (text === "📢 Xabarnoma") {
        pushState(chatId, 'ADMIN_BROADCAST');
        await clearAndSend(chatId, "Barcha foydalanuvchilarga yuboriladigan e'lon/xabar matnini kiriting:", backKeyboard);
      }
      else if (text === "👮‍♂️ Admin qoʻshish") {
        pushState(chatId, 'ADMIN_ADD_CHOICE');
        // Adminlarni boshqarish menyusi tugmalari
        let kbd = { keyboard: [], resize_keyboard: true };
        db.admins.forEach(admId => {
          kbd.keyboard.push([{ text: `Admin ID: ${admId}` }]);
        });
        kbd.keyboard.push([{ text: "➕ Yangi Admin Qo'shish" }]);
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "👮‍♂️ Adminlar boshqaruv paneli. Quyidagi ro'yxatdan adminni tanlang yoki yangi qo'shing:", kbd);
      }
      else if (text === "🏨 HOSTEL Sozlash") {
        pushState(chatId, 'ADMIN_HOSTEL_STRUCT');
        const kbd = {
          keyboard: [
            [{ text: "➕ Viloyat qo'shish" }, { text: "🗑 Viloyatni o'chirish" }],
            [{ text: "➕ Filial qo'shish" }, { text: "🗑 Filialni o'chirish" }],
            [{ text: "➕ Xona qo'shish" }, { text: "🗑 Xonani o'chirish" }],
            [{ text: "➕ Yotoq qo'shish" }, { text: "🗑 Yotoqni o'chirish" }],
            [{ text: "⬅️ Ortga qaytish" }]
          ],
          resize_keyboard: true
        };
        await clearAndSend(chatId, "🏨 HOSTEL Strukturaviy joy sozlamalari bo'limi. Amallardan birini tanlang:", kbd);
      }
      return;
    }

    // --- STRUKTURA SOZLASh MATNLARI ---
    if (state === 'ADMIN_SET_RULES') {
      db.settings.hostel_rules = text; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "✅ HOSTEL Qoidalari muvaffaqiyatli o'zgartirildi!", adminMainKeyboard);
    }
    else if (state === 'ADMIN_SET_INFO') {
      db.settings.hostel_info = text; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "✅ HOSTEL Tanishtiruv ma'lumotlari yangilandi!", adminMainKeyboard);
    }
    else if (state === 'ADMIN_SET_DAILY') {
      const price = parseMoney(text);
      if (price > 0) {
        db.settings.daily_price = price; saveDB();
        sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, `✅ Universal kunlik narx <b>${formatMoney(price)}</b> qilib belgilandi.`, adminMainKeyboard);
      } else {
        await bot.sendMessage(chatId, "Xato raqam kiritildi. Qayta yozing:");
      }
    }
    else if (state === 'ADMIN_SET_CARD_NUM') {
      db.settings.card_number = text; saveDB();
      pushState(chatId, 'ADMIN_SET_CARD_OWNER');
      await clearAndSend(chatId, "Karta egasining ismini kiriting:", backKeyboard);
    }
    else if (state === 'ADMIN_SET_CARD_OWNER') {
      db.settings.card_owner = text; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "✅ Karta rekvizitlari muvaffaqiyatli saqlandi!", adminMainKeyboard);
    }
    else if (state === 'ADMIN_BROADCAST') {
      // Hammaga xabar yuborish
      const allUsers = Object.keys(sessions);
      let count = 0;
      allUsers.forEach(uId => {
        if (uId != chatId) {
          bot.sendMessage(uId, `📢 <b>ADMINOSTRATSIYA E'LONI:</b>\n\n${text}`, { parse_mode: 'HTML' }).catch(e => {});
          count++;
        }
      });
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `✅ Xabarnoma ${count} ta foydalanuvchi chatiga yuborildi.`, adminMainKeyboard);
    }
    else if (state === 'ADMIN_ADD_CHOICE') {
      if (text === "➕ Yangi Admin Qo'shish") {
        pushState(chatId, 'ADMIN_INPUT_NEW_ID');
        await clearAndSend(chatId, "Qo'shmoqchi bo'lgan adminingizning Telegram CHAT ID raqamini yozib yuboring:", backKeyboard);
      } else {
        const idMatch = text.match(/Admin ID: (\d+)/);
        if (idMatch) {
          const selectedAdminId = parseInt(idMatch[1], 10);
          sessions[chatId].selectedAdminId = selectedAdminId;
          pushState(chatId, 'ADMIN_MANAGE_ROLE');
          const isSuper = db.superAdmins.includes(selectedAdminId);
          const roleKbd = {
            keyboard: [
              [isSuper ? { text: "🙅‍♂️ Bosh admin lavozimini olish" } : { text: "👑 Bosh admin lavozimini berish" }],
              [{ text: "🗑 Adminni o'chirish" }],
              [{ text: "⬅️ Ortga qaytish" }]
            ],
            resize_keyboard: true
          };
          await clearAndSend(chatId, `Boshqarilayotgan Admin ID: ${selectedAdminId}\nLavozimi: ${isSuper ? 'Super Admin' : 'Oddiy Admin'}\nAmalni tanlang:`, roleKbd);
        }
      }
    }
    else if (state === 'ADMIN_INPUT_NEW_ID') {
      const newAdminId = parseInt(text, 10);
      if (newAdminId) {
        if (!db.admins.includes(newAdminId)) db.admins.push(newAdminId);
        saveDB();
        sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, `✅ Admin ID: ${newAdminId} muvaffaqiyatli qo'shildi.`, adminMainKeyboard);
      } else {
        await bot.sendMessage(chatId, "Noto'g'ri ID raqam. Qayta kiriting:");
      }
    }
    else if (state === 'ADMIN_MANAGE_ROLE') {
      const selId = sessions[chatId].selectedAdminId;
      if (text === "👑 Bosh admin lavozimini berish") {
        if (!db.superAdmins.includes(selId)) db.superAdmins.push(selId);
        saveDB();
        sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, "✅ Lavozim berildi!", adminMainKeyboard);
      } else if (text === "🙅‍♂️ Bosh admin lavozimini olish") {
        if (selId === MAIN_SUPER_ADMIN) {
          return bot.sendMessage(chatId, "Asosiy tizim yaratuvchisidan huquqni olib bo'lmaydi!");
        }
        db.superAdmins = db.superAdmins.filter(id => id !== selId);
        saveDB();
        sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, "✅ Super admin huquqi olindi.", adminMainKeyboard);
      } else if (text === "🗑 Adminni o'chirish") {
        if (selId === MAIN_SUPER_ADMIN) return bot.sendMessage(chatId, "Asosiy adminni o'chirib bo'lmaydi!");
        db.admins = db.admins.filter(id => id !== selId);
        db.superAdmins = db.superAdmins.filter(id => id !== selId);
        saveDB();
        sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, "✅ Admin ro'yxatdan o'chirildi.", adminMainKeyboard);
      }
    }

    // --- HOSTEL TUZILMASINI SOZLASh LANTIQI ---
    else if (state === 'ADMIN_HOSTEL_STRUCT') {
      if (text === "➕ Viloyat qo'shish") {
        pushState(chatId, 'STRUCT_ADD_VILOYAT');
        await clearAndSend(chatId, "Viloyat nomini kiriting (Masalan: Toshkent viloyati):", backKeyboard);
      } else if (text === "🗑 Viloyatni o'chirish") {
        pushState(chatId, 'STRUCT_DEL_VILOYAT');
        const kbd = { keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "O'chiriladigan viloyatni tanlang:", kbd);
      } else if (text === "➕ Filial qo'shish") {
        pushState(chatId, 'STRUCT_ADD_FILIAL_VIL');
        const kbd = { keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Qaysi viloyatga filial qo'shmoqchisiz? Tanlang:", kbd);
      } else if (text === "🗑 Filialni o'chirish") {
        pushState(chatId, 'STRUCT_DEL_FILIAL_VIL');
        const kbd = { keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Filial o'chirish uchun viloyatni tanlang:", kbd);
      } else if (text === "➕ Xona qo'shish") {
        pushState(chatId, 'STRUCT_ADD_XONA_VIL');
        const kbd = { keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Xona qo'shish uchun viloyatni tanlang:", kbd);
      } else if (text === "🗑 Xonani o'chirish") {
        pushState(chatId, 'STRUCT_DEL_XONA_VIL');
        const kbd = { keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Xona o'chirish uchun viloyatni tanlang:", kbd);
      } else if (text === "➕ Yotoq qo'shish") {
        pushState(chatId, 'STRUCT_ADD_YOTOQ_VIL');
        const kbd = { keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Yotoq qo'shish uchun viloyatni tanlang:", kbd);
      } else if (text === "🗑 Yotoqni o'chirish") {
        pushState(chatId, 'STRUCT_DEL_YOTOQ_VIL');
        const kbd = { keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Yotoq o'chirish uchun viloyatni tanlang:", kbd);
      }
    }
    
    // --- STRUKTURA ICHKI INPUT PROCESSING ---
    else if (state === 'STRUCT_ADD_VILOYAT') {
      if (!db.hostel_structure[text]) db.hostel_structure[text] = {};
      saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `✅ Viloyat "${text}" muvaffaqiyatli qo'shildi.`, adminMainKeyboard);
    }
    else if (state === 'STRUCT_DEL_VILOYAT') {
      delete db.hostel_structure[text]; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `🗑 Viloyat o'chirildi va tozalab yuborildi.`, adminMainKeyboard);
    }
    else if (state === 'STRUCT_ADD_FILIAL_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_ADD_FILIAL_NAME');
      await clearAndSend(chatId, "Yangi Filial nomini kiriting (Masalan: Chilonzor filial):", backKeyboard);
    }
    else if (state === 'STRUCT_ADD_FILIAL_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      if (!db.hostel_structure[vil][text]) db.hostel_structure[vil][text] = {};
      saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `✅ Filial "${text}" qo'shildi.`, adminMainKeyboard);
    }
    // O'chirishlar, xona va yotoqlar chuqurlashuvi mantiqi...
    else if (state === 'STRUCT_DEL_FILIAL_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_DEL_FILIAL_NAME');
      const kbd = { keyboard: Object.keys(db.hostel_structure[text]).map(f => [{ text: f }]), resize_keyboard: true };
      kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(chatId, "O'chiriladigan filialni tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_FILIAL_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      delete db.hostel_structure[vil][text]; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `🗑 Filial butunlay tozalab o'chirildi.`, adminMainKeyboard);
    }
    else if (state === 'STRUCT_ADD_XONA_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_ADD_XONA_FIL');
      const kbd = { keyboard: Object.keys(db.hostel_structure[text]).map(f => [{ text: f }]), resize_keyboard: true };
      await clearAndSend(chatId, "Filialni tanlang:", kbd);
    }
    else if (state === 'STRUCT_ADD_XONA_FIL') {
      sessions[chatId].tempStruct.filial = text;
      pushState(chatId, 'STRUCT_ADD_XONA_NAME');
      await clearAndSend(chatId, "Xona nomini/raqamini kiriting (Masalan: 1-xona):", backKeyboard);
    }
    else if (state === 'STRUCT_ADD_XONA_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      const fil = sessions[chatId].tempStruct.filial;
      if (!db.hostel_structure[vil][fil][text]) db.hostel_structure[vil][fil][text] = {};
      saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `✅ Xona "${text}" qo'shildi.`, adminMainKeyboard);
    }
    else if (state === 'STRUCT_DEL_XONA_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_DEL_XONA_FIL');
      const kbd = { keyboard: Object.keys(db.hostel_structure[text]).map(f => [{ text: f }]), resize_keyboard: true };
      await clearAndSend(chatId, "Filialni tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_XONA_FIL') {
      const vil = sessions[chatId].tempStruct.viloyat;
      sessions[chatId].tempStruct.filial = text;
      pushState(chatId, 'STRUCT_DEL_XONA_NAME');
      const kbd = { keyboard: Object.keys(db.hostel_structure[vil][text]).map(x => [{ text: x }]), resize_keyboard: true };
      await clearAndSend(chatId, "O'chiriladigan xonani tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_XONA_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      const fil = sessions[chatId].tempStruct.filial;
      delete db.hostel_structure[vil][fil][text]; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `🗑 Xona barcha yotoqlari bilan o'chirildi.`, adminMainKeyboard);
    }
    // Yotoq qo'shish zanjiri va NARX BIRIKTIRISh mantiqi
    else if (state === 'STRUCT_ADD_YOTOQ_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_ADD_YOTOQ_FIL');
      const kbd = { keyboard: Object.keys(db.hostel_structure[text]).map(f => [{ text: f }]), resize_keyboard: true };
      await clearAndSend(chatId, "Filialni tanlang:", kbd);
    }
    else if (state === 'STRUCT_ADD_YOTOQ_FIL') {
      const vil = sessions[chatId].tempStruct.viloyat;
      sessions[chatId].tempStruct.filial = text;
      pushState(chatId, 'STRUCT_ADD_YOTOQ_XON');
      const kbd = { keyboard: Object.keys(db.hostel_structure[vil][text]).map(x => [{ text: x }]), resize_keyboard: true };
      await clearAndSend(chatId, "Xonani tanlang:", kbd);
    }
    else if (state === 'STRUCT_ADD_YOTOQ_XON') {
      sessions[chatId].tempStruct.xona = text;
      pushState(chatId, 'STRUCT_ADD_YOTOQ_NAME');
      await clearAndSend(chatId, "Yotoq raqamini/nomini kiriting (Masalan: 1-yotoq):", backKeyboard);
    }
    else if (state === 'STRUCT_ADD_YOTOQ_NAME') {
      sessions[chatId].tempStruct.yotoqName = text;
      pushState(chatId, 'STRUCT_ADD_YOTOQ_PRICE');
      await clearAndSend(chatId, "Ushbu yotoq joyi uchun Oylik To'lov narxini raqamlarda kiriting (Masalan: 650000):", backKeyboard);
    }
    else if (state === 'STRUCT_ADD_YOTOQ_PRICE') {
      const priceNum = parseMoney(text);
      if (priceNum > 0) {
        const vil = sessions[chatId].tempStruct.viloyat;
        const fil = sessions[chatId].tempStruct.filial;
        const xon = sessions[chatId].tempStruct.xona;
        const yot = sessions[chatId].tempStruct.yotoqName;

        db.hostel_structure[vil][fil][xon][yot] = {
          price: priceNum,
          isFree: true
        };
        saveDB();
        sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, `✅ Joy biriktirildi!\n${vil} -> ${fil} -> ${xon} -> ${yot}\nOylik Narxi: <b>${formatMoney(priceNum)}</b> ko'rinishida muvaffaqiyatli o'rnatildi.`, adminMainKeyboard);
      } else {
        await bot.sendMessage(chatId, "Noto'g'ri summa raqami kiritildi. Qayta kiriting:");
      }
    }
    else if (state === 'STRUCT_DEL_YOTOQ_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_DEL_YOTOQ_FIL');
      const kbd = { keyboard: Object.keys(db.hostel_structure[text]).map(f => [{ text: f }]), resize_keyboard: true };
      await clearAndSend(chatId, "Filialni tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_YOTOQ_FIL') {
      const vil = sessions[chatId].tempStruct.viloyat;
      sessions[chatId].tempStruct.filial = text;
      pushState(chatId, 'STRUCT_DEL_YOTOQ_XON');
      const kbd = { keyboard: Object.keys(db.hostel_structure[vil][text]).map(x => [{ text: x }]), resize_keyboard: true };
      await clearAndSend(chatId, "Xonani tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_YOTOQ_XON') {
      const vil = sessions[chatId].tempStruct.viloyat;
      const fil = sessions[chatId].tempStruct.filial;
      sessions[chatId].tempStruct.xona = text;
      pushState(chatId, 'STRUCT_DEL_YOTOQ_NAME');
      const kbd = { keyboard: Object.keys(db.hostel_structure[vil][fil][text]).map(y => [{ text: y }]), resize_keyboard: true };
      await clearAndSend(chatId, "O'chiriladigan yotoq joyini tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_YOTOQ_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      const fil = sessions[chatId].tempStruct.filial;
      const xon = sessions[chatId].tempStruct.xona;
      delete db.hostel_structure[vil][fil][xon][text]; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "🗑 Yotoq joyi ma'lumotlari butunlay o'chirildi.", adminMainKeyboard);
    }
    return;
  }

  // --- ADMIN JAVOB YOZISh/ESLATMA CHATGA KIRITILGANDA ---
  if (state.startsWith('COMMENT_INPUT_')) {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const targetUserId = state.split('_')[2];
    if (db.kvartirantlar[targetUserId]) {
      db.kvartirantlar[targetUserId].eslatma = text;
      saveDB();
      
      // /aktiv yoki /qarz guruhidagi anketani tahrirlash mantiqi
      const targetGroup = db.kvartirantlar[targetUserId].status === 'aktiv' ? db.settings.Aktiv_Guruh : db.settings.Qarz_Guruh;
      const msgIdInGroup = db.kvartirantlar[targetUserId].groupMsgId;
      
      if (targetGroup && msgIdInGroup) {
        const buildText = generateAnketaText(targetUserId);
        const buildMarkup = generateAnketaInlineMarkup(targetUserId);
        try {
          await bot.editMessageText(buildText, { chat_id: targetGroup, message_id: msgIdInGroup, parse_mode: 'HTML', reply_markup: buildMarkup });
        } catch(e){}
      }
      
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "📌 Eslatma muvaffaqiyatli kiritildi va omborxonada yangilandi!", adminMainKeyboard);
    }
  }
});

// ------------------- MULTIMEDIA (RASMLAR) BILAN ISHLOVCHI QISM -------------------
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) return;
  const state = sessions[chatId].state;

  // Ro'yxatdan o'tishda selfi qabul qilish
  if (state === 'REG_SELFIE') {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    sessions[chatId].regData.selfiePhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

    pushState(chatId, 'REG_GENDER');
    await clearAndSend(chatId, "7. Jinsingizni belgilang:", genderKeyboard);
  }
  // Ro'yxatdan o'tishda chek qabul qilish
  else if (state === 'REG_SEND_CHEK') {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    sessions[chatId].regData.chekPhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

    await sendRequestToAdmins(chatId, true);
    sessions[chatId].state = 'MAIN_MENU'; saveSessions();
    await clearAndSend(chatId, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting. Chek tekshirilgach hisobingiz faollashadi.", mainKeyboard);
  }
  // Kvartirant qayta to'lov qilganda chek yuborishi
  else if (state === 'KVAR_SEND_CHEK') {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    sessions[chatId].renewData.chekPhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

    await sendRenewRequestToAdmins(chatId, true);
    sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
    await clearAndSend(chatId, "To'lov skrinshoti adminga yetkazildi. Tekshiruvdan so'ng muddatingiz uzaytiriladi.", kvartirantKeyboard);
  }
  // Kvartirant adminga murojaat yuborganda rasm ilova qilsa
  else if (state === 'KVAR_SEND_MUROJAAT') {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    const captionText = msg.caption || "Matnsiz murojaat rasm ichida.";
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    
    await sendMurojaatToAdmins(chatId, photoId, captionText);
    sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
    await clearAndSend(chatId, "Murojaatingiz barcha adminlarga yuborildi!", kvartirantKeyboard);
  }
});

// ------------------- ANKETA GENERATORLARI VA ADMINGA JURATISH -------------------
function generateAnketaText(userId, isNewPayment = false, renewData = null) {
  const data = db.kvartirantlar[userId] || sessions[userId]?.regData || renewData;
  if (!data) return "Ma'lumot topilmadi.";

  const statusTitle = data.status === 'aktiv' ? "✅ AKTIV  KVARTIRANT" : (data.status === 'qarz' ? "⚠️ QARZDOR Kvartirant" : (data.status === 'arxiv' ? "⛔️ KETGAN Kvartirant" : "🔔 YANGI KVARTIRANT TOʻLOVI"));
  const payType = renewData ? renewData.payType : (data.payType || "Aniqlanmagan");
  const summa = renewData ? renewData.summa : (data.summa || 0);
  const eslatma = data.eslatma || "Yo'q";

  let txt = `<b>${statusTitle}</b>\n\n`;
  if (!data.status) {
    txt += `💵 Toʻlov turi : <b>${payType}</b>\n🤝 Toʻlov Summasi : <b>${formatMoney(summa)}</b>\n`;
  }
  txt += `\n👤 (F.I.SH) : <b>${data.fish || data.name}</b>
📅 Tugʻilgan sanasi : <b>${data.birth}</b>
🪪 Pasport Seriyasi : <b>${data.passport}</b>
🆔 JSHSHIR Raqami : <b>${data.jshshir}</b>
📞 Tel Raqami: <b>${data.phone}</b>
🚩 Viloyat : <b>${data.viloyat}</b>
🏨 Filial : <b>${data.filial}</b>
🚪 Xona : <b>${data.xona}</b>
🛏 Yotoq : <b>${data.yotoq}</b>
📅 Ijara Muddati : <b>${data.muddati}</b>
📌 Eslatma : <b>${eslatma}</b>`;

  if (data.status === 'arxiv') {
    txt += `\n📅 Kelgan muddati : <b>${data.birth || '-'}</b>\n📅 Ketgan muddati : <b>${formatDate(new Date())}</b>`;
  }
  if (payType === "💵 Naqd pul bilan" && !data.status) {
    txt += `\n\n😎 Pulni Qoʻlingizga olgandan soʻng 🤝\n ✅ Tasdiqlang...❕`;
  }

  return txt;
}

function generateAnketaInlineMarkup(userId, mode = "admin_verify") {
  if (mode === "admin_verify") {
    return {
      inline_keyboard: [
        [{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }],
        [{ text: "✅ Tasdiqlash", callback_data: `verify_yes_${userId}` }, { text: "❌ Rad etish", callback_data: `verify_no_${userId}` }]
      ]
    };
  } else if (mode === "group_active") {
    return {
      inline_keyboard: [
        [{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }],
        [{ text: "📌 Eslatma kiritish", callback_data: `group_note_${userId}` }, { text: "❌ Kvartirant ketgan", callback_data: `group_exit_${userId}` }]
      ]
    };
  } else if (mode === "group_archive") {
    return {
      inline_keyboard: [
        [{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }],
        [{ text: "📌 Eslatma kiritish", callback_data: `group_note_${userId}` }, { text: "✅ AKTIV qilish", callback_data: `verify_yes_${userId}` }]
      ]
    };
  }
}

// Birinchi marta ro'yxatdan o'tayotgan arizani yuborish
async function sendRequestToAdmins(userId, hasChek = false) {
  const regData = sessions[userId].regData;
  const txt = generateAnketaText(userId);
  const markup = generateAnketaInlineMarkup(userId, "admin_verify");

  sessions[userId].adminMsgMap = {}; // Barcha adminlarga yuborilgan xabar ID'larini eslab qolish uchun

  for (let admId of db.admins) {
    try {
      let sentMsg;
      if (hasChek && regData.chekPhoto && regData.selfiePhoto) {
        // Ikkala rasmni bitta qilib chiqarish imkoni bo'lmaganda inputMedia ishlatiladi, 
        // qat'iy buyruq bo'yicha rasm ostidan anketa chiqishi uchun bitta xabarda jo'natamiz
        sentMsg = await bot.sendPhoto(admId, regData.chekPhoto, { caption: txt + "\n\n(Selfi yuqorida/alohida)", reply_markup: markup, parse_mode: 'HTML' });
        await bot.sendPhoto(admId, regData.selfiePhoto).catch(e=>{});
      } else {
        sentMsg = await bot.sendPhoto(admId, regData.selfiePhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' });
      }
      sessions[userId].adminMsgMap[admId] = sentMsg.message_id;
    } catch (e) { console.log(`Admin ${admId}ga ariza bormadi`); }
  }
  saveSessions();
}

// Kvartirant muddat uzaytirmoqchi bo'lganida arizani yuborish
async function sendRenewRequestToAdmins(userId, hasChek = false) {
  const renewData = sessions[userId].renewData;
  const kv = db.kvartirantlar[userId];
  const txt = generateAnketaText(userId, true, renewData);
  const markup = {
    inline_keyboard: [
      [{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }],
      [{ text: "✅ To'lovni Tasdiqlash", callback_data: `renew_yes_${userId}` }, { text: "❌ Rad etish", callback_data: `renew_no_${userId}` }]
    ]
  };

  sessions[userId].renewMsgMap = {};

  for (let admId of db.admins) {
    try {
      let sentMsg;
      if (hasChek && renewData.chekPhoto && kv.selfiePhoto) {
        sentMsg = await bot.sendPhoto(admId, renewData.chekPhoto, { caption: txt + "\n\n(Kvartirant qayta to'lovi cheki)", reply_markup: markup, parse_mode: 'HTML' });
      } else {
        sentMsg = await bot.sendPhoto(admId, kv.selfiePhoto, { caption: txt + "\n\n(Naqd to'lov so'rovi)", reply_markup: markup, parse_mode: 'HTML' });
      }
      sessions[userId].renewMsgMap[admId] = sentMsg.message_id;
    } catch(e){}
  }
  saveSessions();
}

// Murojaatni adminlarga yuborish
async function sendMurojaatToAdmins(userId, photoId = null, textMsg = "") {
  const kv = db.kvartirantlar[userId];
  if (!kv) return;

  const murojaatTxt = `🔔 <b>YANGI MUROJAATNOMA</b>\n\n👤 F.I.SH: <b>${kv.fish}</b>\n🚪 Xona: <b>${kv.xona}</b>, Yotoq: <b>${kv.yotoq}</b>\n\n📨 <b>Murojaat matni:</b> ${textMsg}`;
  const markup = { inline_keyboard: [[{ text: "✅ Murojat noma qabul qilindi", callback_data: `murojaat_ok` }]] };

  for (let admId of db.admins) {
    try {
      if (photoId) {
        await bot.sendPhoto(admId, photoId, { caption: murojaatTxt, reply_markup: markup, parse_mode: 'HTML' });
      } else {
        await bot.sendPhoto(admId, kv.selfiePhoto, { caption: murojaatTxt, reply_markup: markup, parse_mode: 'HTML' });
      }
    } catch(e){}
  }
}

// ------------------- INLINE CALLBACK (TUGMALAR) ISHLOVCHISI -------------------
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Qat'iy qonun: Adminlardan biri tasdiqlasa, boshqa barcha adminlarning chatidan xabar sinxron o'chadi
  if (data.startsWith('verify_yes_')) {
    const targetUserId = data.split('_')[2];
    let regData = sessions[targetUserId]?.regData;
    
    // Agar arxivdan qayta aktiv qilinayotgan bo'lsa
    if (!regData && db.kvartirantlar[targetUserId]) {
      regData = db.kvartirantlar[targetUserId];
      regData.status = 'aktiv';
    }

    if (regData) {
      // 1. Barcha adminlar chatidan arizani o'chirish (Sinxronlik)
      if (sessions[targetUserId] && sessions[targetUserId].adminMsgMap) {
        for (let admId of Object.keys(sessions[targetUserId].adminMsgMap)) {
          try { await bot.deleteMessage(admId, sessions[targetUserId].adminMsgMap[admId]); } catch(e){}
        }
      }

      // Bazada kvartirantni yaratish yoki yangilash
      db.kvartirantlar[targetUserId] = {
        fish: regData.fish,
        birth: regData.birth,
        phone: regData.phone,
        passport: regData.passport,
        jshshir: regData.jshshir,
        selfiePhoto: regData.selfiePhoto,
        gender: regData.gender,
        viloyat: regData.viloyat,
        filial: regData.filial,
        xona: regData.xona,
        yotoq: regData.yotoq,
        pricePerMonth: regData.pricePerMonth,
        muddati: regData.muddati,
        summa: regData.summa,
        status: 'aktiv',
        eslatma: regData.eslatma || "Kiritilmagan",
        joinDate: new Date()
      };
      
      // Hostel joy band qilish
      try { db.hostel_structure[regData.viloyat][regData.filial][regData.xona][regData.yotoq].isFree = false; } catch(e){}
      saveDB();

      // Foydalanuvchiga xabar berish
      bot.sendMessage(targetUserId, "🎉 Sizning anketangiz tasdiqlandi, Tinchlik HOSTEL botidan to'liq foydalanishingiz mumkin! /start bosing.");

      // 2. /aktiv omborxona guruhiga qat'iy buyruq bo'yicha yuborish
      if (db.settings.Aktiv_Guruh) {
        const groupText = generateAnketaText(targetUserId);
        const groupMarkup = generateAnketaInlineMarkup(targetUserId, "group_active");
        try {
          const sentGroupMsg = await bot.sendPhoto(db.settings.Aktiv_Guruh, regData.selfiePhoto, { caption: groupText, reply_markup: groupMarkup, parse_mode: 'HTML' });
          db.kvartirantlar[targetUserId].groupMsgId = sentGroupMsg.message_id;
          saveDB();
        } catch (e) { console.log("/aktiv guruhga rasm ketmadi."); }
      }
      
      await bot.answerCallbackQuery(query.id, { text: "Kvartirant muvaffaqiyatli TASDIQLANDI!" });
    }
  }

  else if (data.startsWith('verify_no_')) {
    const targetUserId = data.split('_')[2];
    if (sessions[targetUserId] && sessions[targetUserId].adminMsgMap) {
      for (let admId of Object.keys(sessions[targetUserId].adminMsgMap)) {
        try { await bot.deleteMessage(admId, sessions[targetUserId].adminMsgMap[admId]); } catch(e){}
      }
    }
    bot.sendMessage(targetUserId, "❌ Afsuski, sizning to'lov yoki anketa ma'lumotlaringiz rad etildi.");
    await bot.answerCallbackQuery(query.id, { text: "Ariza rad etildi va o'chirildi." });
  }

  // Muddat uzaytirish to'lovini tasdiqlash
  else if (data.startsWith('renew_yes_')) {
    const targetUserId = data.split('_')[2];
    const renewData = sessions[targetUserId]?.renewData;
    if (renewData && db.kvartirantlar[targetUserId]) {
      
      if (sessions[targetUserId].renewMsgMap) {
        for (let admId of Object.keys(sessions[targetUserId].renewMsgMap)) {
          try { await bot.deleteMessage(admId, sessions[targetUserId].renewMsgMap[admId]); } catch(e){}
        }
      }

      db.kvartirantlar[targetUserId].muddati = renewData.muddati;
      db.kvartirantlar[targetUserId].status = 'aktiv'; // Agar qarzdor bo'lsa qayta aktivlashadi
      saveDB();

      bot.sendMessage(targetUserId, `✅ To'lovingiz qabul qilindi. Ijara muddati ${renewData.muddati}gacha uzaytirildi!`);

      // Guruhdagi xabarni yangilash
      if (db.settings.Aktiv_Guruh && db.kvartirantlar[targetUserId].groupMsgId) {
        const buildText = generateAnketaText(targetUserId);
        const buildMarkup = generateAnketaInlineMarkup(targetUserId, "group_active");
        try {
          await bot.editMessageText(buildText, { chat_id: db.settings.Aktiv_Guruh, message_id: db.kvartirantlar[targetUserId].groupMsgId, parse_mode: 'HTML', reply_markup: buildMarkup });
        } catch(e){}
      }

      await bot.answerCallbackQuery(query.id, { text: "To'lov tasdiqlandi!" });
    }
  }

  // --- GURUHLAR ICHIDAGI INLINE TUGMALAR ISHLOVCHISI ---
  else if (data.startsWith('group_note_')) {
    const targetUserId = data.split('_')[2];
    // Tugmani bosgan adminning shaxsiy chatiga so'rov yuborish
    const clickerAdminId = query.from.id;
    sessions[clickerAdminId] = { state: `COMMENT_INPUT_${targetUserId}`, history: [], lastMessageIds: [] };
    saveSessions();

    try {
      await bot.sendMessage(clickerAdminId, "Kiritmoqchi boʻlgan 📌 Eslatma xabaringizni Chatga yozib yuboring:");
      await bot.answerCallbackQuery(query.id, { text: "Shaxsiy chatingizga o'ting va eslatmani yozing!" });
    } catch (e) {
      await bot.answerCallbackQuery(query.id, { text: "Avval botga shaxsiy chatda /start bosing!" });
    }
  }

  else if (data.startsWith('group_exit_')) {
    const targetUserId = data.split('_')[2];
    const kv = db.kvartirantlar[targetUserId];
    if (kv) {
      // Aktiv yoki Qarz guruhidagi eski xabarni o'chirish
      const oldGroup = kv.status === 'aktiv' ? db.settings.Aktiv_Guruh : db.settings.Qarz_Guruh;
      if (oldGroup && kv.groupMsgId) {
        try { await bot.deleteMessage(oldGroup, kv.groupMsgId); } catch(e){}
      }

      // Xonani bo'shatish
      try { db.hostel_structure[kv.viloyat][kv.filial][kv.xona][kv.yotoq].isFree = true; } catch(e){}
      
      kv.status = 'arxiv';
      saveDB();

      // /arxiv guruhiga qat'iy tartibda yuborish
      if (db.settings.Ketgan_Guruh) {
        const arcText = generateAnketaText(targetUserId);
        const arcMarkup = generateAnketaInlineMarkup(targetUserId, "group_archive");
        try {
          const sentArcMsg = await bot.sendPhoto(db.settings.Ketgan_Guruh, kv.selfiePhoto, { caption: arcText, reply_markup: arcMarkup, parse_mode: 'HTML' });
          db.kvartirantlar[targetUserId].groupMsgId = sentArcMsg.message_id;
          saveDB();
        } catch(e){}
      }
      await bot.answerCallbackQuery(query.id, { text: "Kvartirant arxivga ko'chirildi (Ketganlar)." });
    }
  }

  else if (data === 'murojaat_ok') {
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch(e){}
    await bot.answerCallbackQuery(query.id, { text: "Murojaat yopildi." });
  }
});

// ------------------- STATE-RETURN (ORTGA QAYTISh NAVIGATION) -------------------
async function handleStateReturn(chatId, prevState) {
  if (prevState === 'MAIN_MENU') {
    if (db.kvartirantlar[chatId] && (db.kvartirantlar[chatId].status === 'aktiv' || db.kvartirantlar[chatId].status === 'qarz')) {
      return await clearAndSend(chatId, "Asosiy menyu:", kvartirantKeyboard);
    }
    await clearAndSend(chatId, "Asosiy menyu:", mainKeyboard);
  } else if (prevState === 'ADMIN_MAIN') {
    await clearAndSend(chatId, "👑 Admin paneliga qaytdingiz:", adminMainKeyboard);
  } else if (prevState === 'ADMIN_HOSTEL_STRUCT') {
    const kbd = {
      keyboard: [
        [{ text: "➕ Viloyat qo'shish" }, { text: "🗑 Viloyatni o'chirish" }],
        [{ text: "➕ Filial qo'shish" }, { text: "🗑 Filialni o'chirish" }],
        [{ text: "➕ Xona qo'shish" }, { text: "🗑 Xonani o'chirish" }],
        [{ text: "➕ Yotoq qo'shish" }, { text: "🗑 Yotoqni o'chirish" }],
        [{ text: "⬅️ Ortga qaytish" }]
      ],
      resize_keyboard: true
    };
    await clearAndSend(chatId, "Struktura sozlamalari:", kbd);
  } else if (prevState === 'KVARTIRANT_MENU') {
    await clearAndSend(chatId, "Profilingiz paneli:", kvartirantKeyboard);
  }
}

// ------------------- 🕒 CHRON TASK: QARZDORLARNI TEKShIRISh (KUNIGA 3 MAHAL) -------------------
// Qat'iy buyruq: Ijara tugashiga 3 kun qolganda ogohlantirish, tugasa /qarz guruhiga ko'chirish
cron.schedule('0 9,14,20 * * *', async () => {
  console.log("Qarzdorlik tekshirilmoqda...");
  const now = new Date();

  for (let uId of Object.keys(db.kvartirantlar)) {
    const kv = db.kvartirantlar[uId];
    if (kv.status !== 'aktiv' && kv.status !== 'qarz') continue;

    // Sanani parsing qilish (Kun.Oy.Yil)
    const parts = kv.muddati.split('.');
    if (parts.length !== 3) continue;
    const expiryDate = new Date(parts[2], parts[1] - 1, parts[0]);

    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 61 * 60 * 24));

    // 3, 2, 1 kun qolgandagi ogohlantirish e'loni
    if (diffDays <= 3 && diffDays > 0) {
      const warnMsg = `⚠️ <b>DIQQAT OGOHLANTIRISH!</b>\nHurmatli kvartirant, sizning ijara muddatingiz tugashiga <b>${diffDays} kun</b> qoldi. Iltimos to'lovni amalga oshiring!`;
      await bot.sendMessage(uId, warnMsg, { parse_mode: 'HTML' }).catch(e=>{});
    } 
    // Muddat butunlay tugaganda va to'lanmaganda qarzga o'tkazish
    else if (diffDays <= 0 && kv.status === 'aktiv') {
      // Aktiv guruhdan o'chirish
      if (db.settings.Aktiv_Guruh && kv.groupMsgId) {
        try { await bot.deleteMessage(db.settings.Aktiv_Guruh, kv.groupMsgId); } catch(e){}
      }

      kv.status = 'qarz';
      saveDB();

      // Kvartirantga xabar
      await bot.sendMessage(uId, "⚠️ Sizning ijara muddatingiz yakunlandi va siz QARZDORLAR ro'yxatiga kiritildingiz! Iltimos to'lov qiling.").catch(e=>{});

      // /qarz guruhiga ko'chirish
      if (db.settings.Qarz_Guruh) {
        const qarzText = generateAnketaText(uId);
        const qarzMarkup = generateAnketaInlineMarkup(uId, "group_active"); // qarzda ham eslatma va tark etish tugmasi faol
        try {
          const sentQarzMsg = await bot.sendPhoto(db.settings.Qarz_Guruh, kv.selfiePhoto, { caption: qarzText, reply_markup: qarzMarkup, parse_mode: 'HTML' });
          db.kvartirantlar[uId].groupMsgId = sentQarzMsg.message_id;
          saveDB();
        } catch(e){}
      }
    }
  }
});

console.log("🚀 Tinchlik Hostel Boti muvaffaqiyatli ishga tushdi!");
