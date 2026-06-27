const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Tinchlik Hostel Bot faol va ishlamoqda!');
});

app.listen(PORT, () => {
  console.log(`Veb-server ${PORT}-portda muvaffaqiyatli tinglamoqda.`);
});

/*
 * ============================================================================
 * TINCHLIK HOSTEL - ADVANCED CRM BOT (MUKAMMAL VERSIYA)
 * ============================================================================
 */

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// ------------------- SOZLAMALAR VA TOKENLAR -------------------
const TOKEN =  '8949142604:AAHERMT6uleHZMlHgNDSov3nW4L2R0PMqj8';
const MAIN_SUPER_ADMIN = 8485164743; // O'zingizning ID raqamingizni kiriting

const bot = new TelegramBot(TOKEN, { polling: true });

// ------------------- BAZA STRUKTURASI -------------------
const DB_FILE = path.join(__dirname, 'database.json');
const SESSION_FILE = path.join(__dirname, 'sessions.json');

let db = {
  admins: [MAIN_SUPER_ADMIN],
  superAdmins: [MAIN_SUPER_ADMIN],
  settings: {
    hostel_rules: "Hali qoidalar kiritilmagan",
    card_number: "0000 0000 0000 0000",
    card_owner: "Hali mavjud emas",
    daily_price: 50000,
    Aktiv_Guruh: null,
    Qarz_Guruh: null,
    Ketgan_Guruh: null
  },
  hostel_intro: {},     // Filial -> tanishuv xabarlari (rasmlar va matnlar)
  hostel_structure: {}, // Viloyat -> Filial -> Xona -> Yotoqlar {price, isFree}
  kvartirantlar: {},    // user_id -> ma'lumotlar
  archive: []           // Eskilar tarixi
};

let sessions = {};

// Fayldan ma'lumotlarni xavfsiz yuklash
if (fs.existsSync(DB_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

if (fs.existsSync(SESSION_FILE)) {
  try { sessions = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); } catch (e) {}
} else {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); }
function saveSessions() { fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf8'); }

// ------------------- YORDAMCHI FUNKSIYALAR -------------------
function formatMoney(amount) {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " soʻm";
}

function parseMoney(text) {
  return parseInt(text.replace(/\s+/g, ''), 10) || 0;
}

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Bot Chatining tozaligini taʼminlash (Faqat amallar va eskilarni tozalaydi)
async function clearAndSend(chatId, text, replyMarkup) {
  if (!sessions[chatId]) sessions[chatId] = { history: [], lastMessageIds: [] };

  // Eski oddiy xabarlarni tozalash (start va admin menyularidan tashqari)
  if (sessions[chatId].lastMessageIds) {
    for (let msgId of sessions[chatId].lastMessageIds) {
      try { await bot.deleteMessage(chatId, msgId); } catch (e) {}
    }
  }
  sessions[chatId].lastMessageIds = [];

  try {
    const sentMsg = await bot.sendMessage(chatId, text, { reply_markup: replyMarkup, parse_mode: 'HTML' });
    sessions[chatId].lastMessageIds.push(sentMsg.message_id);
    saveSessions();
  } catch (e) {}
}

function pushState(chatId, state) {
  if (!sessions[chatId]) sessions[chatId] = { history: [], lastMessageIds: [] };
  sessions[chatId].history.push(state);
  sessions[chatId].state = state;
  saveSessions();
}

function popState(chatId) {
  if (!sessions[chatId] || sessions[chatId].history.length <= 1) return 'MAIN_MENU';
  sessions[chatId].history.pop();
  return sessions[chatId].history[sessions[chatId].history.length - 1] || 'MAIN_MENU';
}

// ------------------- KLAVIATURALAR -------------------
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
    [{ text: "⛅ KUNLIK Toʻlovni sozlash" }]
  ],
  resize_keyboard: true
};

const backKeyboard = {
  keyboard: [[{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

const genderKeyboard = {
  keyboard: [[{ text: "Ayol" }, { text: "Erkak" }], [{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

const paymentTypeKeyboard = {
  keyboard: [[{ text: "💳 Karta orqali" }, { text: "💵 Naqd pul bilan" }], [{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

const qoldirishKeyboard = {
  keyboard: [[{ text: "✅ Qoldirish" }], [{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

const yakunlashKeyboard = {
  keyboard: [[{ text: "✅ Yakunlash" }], [{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

// ------------------- BUYRUQLAR ISHLOVCHISI -------------------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) sessions[chatId] = { history: [], lastMessageIds: [] };

  // O'zaro almashish qoidasi
  if (sessions[chatId].adminMenuMsgId) {
    try { await bot.deleteMessage(chatId, sessions[chatId].adminMenuMsgId); } catch(e){}
    delete sessions[chatId].adminMenuMsgId;
  }
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  let sentMsg;
  if (db.kvartirantlar[chatId] && (db.kvartirantlar[chatId].status === 'aktiv' || db.kvartirantlar[chatId].status === 'qarz')) {
    const filial = db.kvartirantlar[chatId].filial || "HOSTEL";
    pushState(chatId, 'KVARTIRANT_MENU');
    sentMsg = await bot.sendMessage(chatId, `Assalomu alaykum <b>${filial}</b> Profilingizga xush kelibsiz...❕`, { reply_markup: kvartirantKeyboard, parse_mode: 'HTML' });
  } else {
    pushState(chatId, 'MAIN_MENU');
    sentMsg = await bot.sendMessage(chatId, "<b>Tinchlik HOSTEL</b> tizimiga xush kelibsiz! Quyidagi tugmalardan birini tanlang:", { reply_markup: mainKeyboard, parse_mode: 'HTML' });
  }
  sessions[chatId].startMenuMsgId = sentMsg.message_id;
  saveSessions();
});

bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (!db.admins.includes(chatId)) {
    return bot.sendMessage(chatId, "Kechirasiz hurmatli foydalanuvchi Siz Admin paneliga kirish huquqiga ega emassiz...!");
  }

  if (!sessions[chatId]) sessions[chatId] = { history: [], lastMessageIds: [] };
  
  if (sessions[chatId].startMenuMsgId) {
    try { await bot.deleteMessage(chatId, sessions[chatId].startMenuMsgId); } catch(e){}
    delete sessions[chatId].startMenuMsgId;
  }

  pushState(chatId, 'ADMIN_MAIN');
  const sentMsg = await bot.sendMessage(chatId, "👑 <b>Admin paneliga xush kelibsiz!</b>\nBarcha tizim boshqaruv elementlari quyida joylashgan:", { reply_markup: adminMainKeyboard, parse_mode: 'HTML' });
  sessions[chatId].adminMenuMsgId = sentMsg.message_id;
  saveSessions();
});

bot.onText(/\/(aktiv|qarz|ketgan)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1];
  if (!db.admins.includes(msg.from.id)) return;

  if (command === "aktiv") {
    db.settings.Aktiv_Guruh = chatId;
    await bot.sendMessage(chatId, "✅ Ushbu guruh AKTIV kvartirantlar bazasi sifatida sozlandi.");
  } else if (command === "qarz") {
    db.settings.Qarz_Guruh = chatId;
    await bot.sendMessage(chatId, "⚠️ Ushbu guruh QARZDORLAR bazasi sifatida sozlandi.");
  } else if (command === "ketgan") {
    db.settings.Ketgan_Guruh = chatId;
    await bot.sendMessage(chatId, "❌ Ushbu guruh KETGAN kvartirantlar arxiviga aylantirildi.");
  }
  saveDB();
});

// ------------------- ASOSIY MATN ISHLOVCHISI -------------------
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text && !msg.photo) return;
  if (text && text.startsWith('/')) return;
  if (!sessions[chatId]) sessions[chatId] = { state: 'MAIN_MENU', history: [], lastMessageIds: [] };

  const state = sessions[chatId].state;

  if (text === "⬅️ Ortga qaytish") {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const prevState = popState(chatId);
    sessions[chatId].state = prevState;
    saveSessions();
    await handleStateReturn(chatId, prevState);
    return;
  }

  // ====== ODDIY FOYDALANUVCHI ======
  if (state === 'MAIN_MENU') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    if (text === "👤 Roʻyxatdan oʻtish") {
      pushState(chatId, 'REG_FISH');
      await clearAndSend(chatId, "1. Foydalanuvchi Familiya Ism Sharifi F.I.SH kiriting:", backKeyboard);
    } else if (text === "🏨 HOSTEL bilan tanishish") {
      pushState(chatId, 'VIEW_INTRO_FILIAL');
      const filiallar = [];
      for (const v in db.hostel_structure) {
        for (const f in db.hostel_structure[v]) filiallar.push([{ text: f, callback_data: `intro_${f}` }]);
      }
      if (filiallar.length === 0) return await clearAndSend(chatId, "Hozirda filiallar mavjud emas.", mainKeyboard);
      await clearAndSend(chatId, "Qaysi Filial haqida bilmoqchisiz?", { inline_keyboard: filiallar });
    } else if (text === "🛂 HOSTEL Qoidalar") {
      await clearAndSend(chatId, `📝 <b>HOSTEL Qoidalari:</b>\n\n${db.settings.hostel_rules}`, mainKeyboard);
    }
    return;
  }

  // ====== RO'YXATDAN O'TISH ======
  if (state.startsWith('REG_')) {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    
    if (state === 'REG_FISH') {
      sessions[chatId].regData = { fish: text };
      pushState(chatId, 'REG_BIRTHTIME');
      await clearAndSend(chatId, "2. Kun.Oy.Yil tartibida Tugʻilgan sanasini kiriting (Masalan: 25.12.2000):", backKeyboard);
    } 
    else if (state === 'REG_BIRTHTIME') {
      sessions[chatId].regData.birth = text;
      pushState(chatId, 'REG_PHONE');
      await clearAndSend(chatId, "3. Telefon raqamini kiriting:", backKeyboard);
    } 
    else if (state === 'REG_PHONE') {
      sessions[chatId].regData.phone = text;
      pushState(chatId, 'REG_PASSPORT');
      await clearAndSend(chatId, "4. Pasport Seriya Raqami kiriting (Masalan: AD1234567):", backKeyboard);
    } 
    else if (state === 'REG_PASSPORT') {
      sessions[chatId].regData.passport = text;
      pushState(chatId, 'REG_JSHSHIR');
      await clearAndSend(chatId, "5. Pasport JSHSHIR Raqamini kiriting:", backKeyboard);
    } 
    else if (state === 'REG_JSHSHIR') {
      sessions[chatId].regData.jshshir = text;
      pushState(chatId, 'REG_SELFIE');
      await clearAndSend(chatId, "6. Foydalanuvchi yuzini Selfi Rasmini botga yuboring:", backKeyboard);
    } 
    else if (state === 'REG_GENDER') {
      if (text === "Erkak" || text === "Ayol") {
        sessions[chatId].regData.gender = text;
        pushState(chatId, 'REG_VILOYAT');
        const viloyatlar = Object.keys(db.hostel_structure || {});
        if (viloyatlar.length === 0) return await clearAndSend(chatId, "Hozirda tizimda viloyat yo'q.", mainKeyboard);
        const kbd = { keyboard: viloyatlar.map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "8. Viloyatni tanlang:", kbd);
      }
    }
    else if (state === 'REG_VILOYAT') {
      if (db.hostel_structure[text]) {
        sessions[chatId].regData.viloyat = text;
        pushState(chatId, 'REG_FILIAL');
        const filiallar = Object.keys(db.hostel_structure[text] || {});
        const kbd = { keyboard: filiallar.map(f => [{ text: f }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Filialni tanlang:", kbd);
      }
    }
    else if (state === 'REG_FILIAL') {
      const vil = sessions[chatId].regData.viloyat;
      if (db.hostel_structure[vil][text]) {
        sessions[chatId].regData.filial = text;
        pushState(chatId, 'REG_XONA');
        const xonalar = Object.keys(db.hostel_structure[vil][text] || {});
        const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Xonani tanlang:", kbd);
      }
    }
    else if (state === 'REG_XONA') {
      const vil = sessions[chatId].regData.viloyat;
      const fil = sessions[chatId].regData.filial;
      if (db.hostel_structure[vil][fil][text]) {
        sessions[chatId].regData.xona = text;
        pushState(chatId, 'REG_YOTOQ');
        const barchaYotoqlar = db.hostel_structure[vil][fil][text] || {};
        const boShYotoqlar = Object.keys(barchaYotoqlar).filter(y => barchaYotoqlar[y].isFree);
        
        if (boShYotoqlar.length === 0) return await bot.sendMessage(chatId, "Ushbu xonada barcha yotoqlar band!");
        
        const kbd = { keyboard: boShYotoqlar.map(y => [{ text: y }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Yotoqni tanlang:", kbd);
      }
    }
    else if (state === 'REG_YOTOQ') {
      const vil = sessions[chatId].regData.viloyat;
      const fil = sessions[chatId].regData.filial;
      const xon = sessions[chatId].regData.xona;
      if (db.hostel_structure[vil][fil][xon][text]) {
        sessions[chatId].regData.yotoq = text;
        const oylikNarx = db.hostel_structure[vil][fil][xon][text].price || 0;
        sessions[chatId].regData.pricePerMonth = oylikNarx;

        pushState(chatId, 'REG_DURATION');
        const durKbd = {
          keyboard: [
            [{ text: "Oylik Toʻlov" }],
            [{ text: "1 kunlik" }, { text: "2 kunlik" }, { text: "3 kunlik" }],
            [{ text: "4 kunlik" }, { text: "5 kunlik" }, { text: "6 kunlik" }],
            [{ text: "7 kunlik" }, { text: "8 kunlik" }, { text: "9 kunlik" }, { text: "10 kunlik" }],
            [{ text: "⬅️ Ortga qaytish" }]
          ], resize_keyboard: true
        };
        await clearAndSend(chatId, `Oylik Narxi: ${formatMoney(oylikNarx)}\nToʻlov turini tanlash (Kunlik narx: ${formatMoney(db.settings.daily_price)}):`, durKbd);
      }
    }
    else if (state === 'REG_DURATION') {
      let totalSum = 0;
      let endDate = new Date();

      if (text === "Oylik Toʻlov") {
        totalSum = sessions[chatId].regData.pricePerMonth;
        endDate.setMonth(endDate.getMonth() + 1); 
        sessions[chatId].regData.durType = "Oylik";
      } else {
        const match = text.match(/(\d+)/);
        if (match) {
          const kunlar = parseInt(match[1], 10);
          totalSum = kunlar * db.settings.daily_price;
          endDate.setDate(endDate.getDate() + kunlar);
          sessions[chatId].regData.durType = `${kunlar} kunlik`;
        }
      }
      sessions[chatId].regData.muddati = formatDate(endDate);
      sessions[chatId].regData.summa = totalSum;

      pushState(chatId, 'REG_PAYTYPE');
      await clearAndSend(chatId, `Toʻlov summasi: ${formatMoney(totalSum)}\nToʻlov turini tanlang:`, paymentTypeKeyboard);
    }
    else if (state === 'REG_PAYTYPE') {
      if (text === "💳 Karta orqali") {
        sessions[chatId].regData.payType = "💳 Karta orqali";
        pushState(chatId, 'REG_CHEK');
        await clearAndSend(chatId, `Admin kartasi: <code>${db.settings.card_number}</code>\nToʻlov skrinshotini yuboring:`, backKeyboard);
      } else if (text === "💵 Naqd pul bilan") {
        sessions[chatId].regData.payType = "💵 Naqd pul bilan";
        await sendRequestToAdmins(chatId, false);
        sessions[chatId].state = 'MAIN_MENU'; saveSessions();
        await clearAndSend(chatId, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting.", mainKeyboard);
      }
    }
    return;
  }

  // ====== KVARTIRANT DASHBOARD ======
  if (state === 'KVARTIRANT_MENU') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const kv = db.kvartirantlar[chatId];
    if (text === "📅 Ijara Muddati") {
      await clearAndSend(chatId, `Sizning ijara muddatingiz: ${kv.muddati} gacha.`, kvartirantKeyboard);
    } else if (text === "💵 Toʻlov qilish") {
      pushState(chatId, 'KVAR_DURATION');
      const durKbd = {
        keyboard: [
          [{ text: "Oylik Toʻlov" }],
          [{ text: "1 kunlik" }, { text: "2 kunlik" }, { text: "3 kunlik" }],
          [{ text: "4 kunlik" }, { text: "5 kunlik" }, { text: "6 kunlik" }],
          [{ text: "7 kunlik" }, { text: "8 kunlik" }, { text: "9 kunlik" }, { text: "10 kunlik" }],
          [{ text: "⬅️ Ortga qaytish" }]
        ], resize_keyboard: true
      };
      await clearAndSend(chatId, "Muddatingizni qanchaga uzaytirmoqchisiz?", durKbd);
    } else if (text === "💳 Karta Raqam") {
      await clearAndSend(chatId, `Karta: <code>${db.settings.card_number}</code>\nEgasining ismi: <b>${db.settings.card_owner}</b>`, kvartirantKeyboard);
    } else if (text === "📜 Qoidalar") {
      await clearAndSend(chatId, `🛂 <b>HOSTEL Qoidalari:</b>\n\n${db.settings.hostel_rules}`, kvartirantKeyboard);
    } else if (text === "🛂 Adminga murojat yoʻllash") {
      pushState(chatId, 'KVAR_MUROJAT');
      await clearAndSend(chatId, "📨 Murojat noma : (matn yozing)", backKeyboard);
    }
    return;
  }

  if (state === 'KVAR_DURATION') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const kv = db.kvartirantlar[chatId];
    let totalSum = 0;
    let expDate = new Date();
    if (kv && kv.muddati) {
      const p = kv.muddati.split('.');
      const pd = new Date(p[2], p[1] - 1, p[0]);
      if (pd > expDate) expDate = pd; 
    }

    if (text === "Oylik Toʻlov") {
      totalSum = kv.pricePerMonth || db.settings.daily_price * 30;
      expDate.setMonth(expDate.getMonth() + 1);
    } else {
      const match = text.match(/(\d+)/);
      if (match) {
        totalSum = parseInt(match[1], 10) * db.settings.daily_price;
        expDate.setDate(expDate.getDate() + parseInt(match[1], 10));
      }
    }
    sessions[chatId].renewData = { summa: totalSum, muddati: formatDate(expDate) };
    pushState(chatId, 'KVAR_PAYTYPE');
    await clearAndSend(chatId, `Summa: ${formatMoney(totalSum)}\nToʻlov turini tanlang:`, paymentTypeKeyboard);
    return;
  }

  if (state === 'KVAR_PAYTYPE') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    if (text === "💳 Karta orqali") {
      sessions[chatId].renewData.payType = "💳 Karta orqali";
      pushState(chatId, 'KVAR_CHEK');
      await clearAndSend(chatId, `To'lov chekini yuboring:`, backKeyboard);
    } else if (text === "💵 Naqd pul bilan") {
      sessions[chatId].renewData.payType = "💵 Naqd pul bilan";
      await sendRenewRequestToAdmins(chatId, false);
      sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
      await clearAndSend(chatId, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting.", kvartirantKeyboard);
    }
    return;
  }

    // ====== ADMIN BOSHQRUV ======
  if (db.admins.includes(chatId) && state.startsWith('ADMIN_')) {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

    if (state === 'ADMIN_MAIN') {
      if (text === "📊 STATISTIKA") {
        let aktivlar = 0, erkaklar = 0, ayollar = 0, qarzdorlar = 0, qarzSumma = 0, buOyda = 0;
        let boshYotoqlar = 0;
        Object.values(db.kvartirantlar).forEach(k => {
          if (k.status === 'aktiv') {
            aktivlar++;
            if (k.gender === 'Erkak') erkaklar++;
            if (k.gender === 'Ayol') ayollar++;
          }
          if (k.status === 'qarz') { qarzdorlar++; qarzSumma += k.summa || 0; }
          if (k.joinDate) {
            const d = new Date(k.joinDate);
            const now = new Date();
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) buOyda++;
          }
        });
        
        Object.values(db.hostel_structure).forEach(v => Object.values(v).forEach(f => Object.values(f).forEach(x => Object.values(x).forEach(y => { if (y.isFree) boshYotoqlar++; }))));

        const statText = `📊 <b>HOSTEL STATISTIKASI</b>\n\n👥 Aktiv Kvartirantlar : ${aktivlar} ta\nErkaklar — ${erkaklar}\nAyollar   — ${ayollar}\n\n🛏 Boʻsh yotoqlar : ${boshYotoqlar} ta\n📉 Qarzdorlar soni: ${qarzdorlar} kishi\n💰 Olinmagan qarzlar: ${formatMoney(qarzSumma)}\n\n👉👤Bu Oyda nechta Kvartirant qoʻshildi... — ${buOyda}`;
        await clearAndSend(chatId, statText, adminMainKeyboard);
      }
      else if (text === "📜 Qoida sozlash") {
        pushState(chatId, 'ADMIN_RULES');
        await clearAndSend(chatId, "Yangi qoidalarni yozib yuboring:", backKeyboard);
      }
      else if (text === "💳 Karta Sozlamalari") {
        pushState(chatId, 'ADMIN_CARD');
        await clearAndSend(chatId, "Yangi karta raqamini yozing:", backKeyboard);
      }
      else if (text === "⛅ KUNLIK Toʻlovni sozlash") {
        pushState(chatId, 'ADMIN_DAILY');
        await clearAndSend(chatId, "Kunlik narxni yozib yuboring:", backKeyboard);
      }
      else if (text === "📢 Xabarnoma") {
        pushState(chatId, 'ADMIN_BROADCAST');
        await clearAndSend(chatId, "E'lon matnini kiriting:", backKeyboard);
      }
      else if (text === "👮‍♂️ Admin qoʻshish") {
        pushState(chatId, 'ADMIN_ADD');
        let kbd = { keyboard: db.admins.map(a => [{ text: `Admin: ${a}` }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "➕ Yangi Admin Qo'shish" }, { text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Kerakli ID'ni tanlang yoki yangisini qo'shing:", kbd);
      }
      else if (text === "🏨 HOSTEL Sozlash") {
        pushState(chatId, 'ADMIN_STRUCT');
        const kbd = {
          keyboard: [
            [{ text: "➕ Viloyat qo'shish" }, { text: "🗑️ Viloyatni o'chirish" }],
            [{ text: "➕ Filiall qo'shish" }, { text: "🗑️ Filialni o'chirish" }],
            [{ text: "➕ Xona qo'shish" }, { text: "🗑️ Xonani o'chirish" }],
            [{ text: "➕ Yotoq qo'shish" }, { text: "🗑️ Yotoqni o'chirish" }],
            [{ text: "⬅️ Ortga qaytish" }]
          ], resize_keyboard: true
        };
        await clearAndSend(chatId, "🏨 HOSTEL Struktura Matrixi:", kbd);
      }
      else if (text === "🏨 HOSTEL tanishuv sozlamalari") {
        pushState(chatId, 'ADMIN_INTRO_VILOYAT');
        const filiallar = [];
        for (const v in db.hostel_structure) {
          for (const f in db.hostel_structure[v]) filiallar.push([{ text: f, callback_data: `setintro_${f}` }]);
        }
        if (filiallar.length === 0) return await clearAndSend(chatId, "Avval Filial qo'shing.", adminMainKeyboard);
        await clearAndSend(chatId, "Qaysi Filialga Tanishtiruv Xabaringizni Kiritmoqchisiz?", { inline_keyboard: filiallar });
      }
      return;
    }

    if (state === 'ADMIN_RULES') { db.settings.hostel_rules = text; saveDB(); popState(chatId); await clearAndSend(chatId, "✅ Saqlandi.", adminMainKeyboard); }
    else if (state === 'ADMIN_CARD') { db.settings.card_number = text; saveDB(); pushState(chatId, 'ADMIN_CARD_OWNER'); await clearAndSend(chatId, "Karta egasi ismini kiriting:", backKeyboard); }
    else if (state === 'ADMIN_CARD_OWNER') { db.settings.card_owner = text; saveDB(); popState(chatId); popState(chatId); await clearAndSend(chatId, "✅ Saqlandi.", adminMainKeyboard); }
    else if (state === 'ADMIN_DAILY') { db.settings.daily_price = parseMoney(text); saveDB(); popState(chatId); await clearAndSend(chatId, "✅ Saqlandi.", adminMainKeyboard); }
    else if (state === 'ADMIN_BROADCAST') {
      Object.keys(sessions).forEach(u => { if (parseInt(u) !== chatId) bot.sendMessage(u, `📢 E'LON:\n${text}`); });
      popState(chatId); await clearAndSend(chatId, "✅ Yuborildi.", adminMainKeyboard);
    }
    else if (state === 'ADMIN_ADD') {
      if (text === "➕ Yangi Admin Qo'shish") {
        pushState(chatId, 'ADMIN_ADD_ID');
        await clearAndSend(chatId, "Yangi Admin Chat ID raqamini yuboring:", backKeyboard);
      }
    }
    else if (state === 'ADMIN_ADD_ID') {
      const id = parseInt(text);
      if (id && !db.admins.includes(id)) { db.admins.push(id); saveDB(); }
      popState(chatId); popState(chatId);
      await clearAndSend(chatId, "✅ Qo'shildi.", adminMainKeyboard);
    }

    // --- STRUKTURA MATRIXI ---
    if (state === 'ADMIN_STRUCT') {
      if (text === "➕ Viloyat qo'shish") { pushState(chatId, 'ST_ADD_V'); await clearAndSend(chatId, "Kiritmoqchi boʻlgan Viloyati nomini yozib yuboring:", backKeyboard); }
      else if (text === "🗑️ Viloyatni o'chirish") {
        pushState(chatId, 'ST_DEL_V');
        const kb = { inline_keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v, callback_data: `del_v_${v}` }]) };
        await clearAndSend(chatId, "Oʻchirish kerak boʻlgan viloyatni tanlang:", kb);
      }
      else if (text === "➕ Filiall qo'shish") {
        pushState(chatId, 'ST_ADD_F_V');
        const kb = { inline_keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v, callback_data: `add_f_v_${v}` }]) };
        await clearAndSend(chatId, "Filiall Kiritmoqchi boʻlgan Viloyatingizdi tanlang:", kb);
      }
      else if (text === "🗑️ Filialni o'chirish") {
        pushState(chatId, 'ST_DEL_F_V');
        const kb = { inline_keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v, callback_data: `del_f_v_${v}` }]) };
        await clearAndSend(chatId, "Oʻchirilishi kerak boʻlgan Filiall Viloyatini tanlang:", kb);
      }
      else if (text === "➕ Xona qo'shish") {
        pushState(chatId, 'ST_ADD_X_V');
        const kb = { inline_keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v, callback_data: `add_x_v_${v}` }]) };
        await clearAndSend(chatId, "Xona kiritmoqchi boʻlgan Viloyatingizdi tanlang:", kb);
      }
      else if (text === "🗑️ Xonani o'chirish") {
        pushState(chatId, 'ST_DEL_X_V');
        const kb = { inline_keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v, callback_data: `del_x_v_${v}` }]) };
        await clearAndSend(chatId, "Oʻchirilishi kerak boʻlgan Xonaning Viloyatini tanlang:", kb);
      }
      else if (text === "➕ Yotoq qo'shish") {
        pushState(chatId, 'ST_ADD_Y_V');
        const kb = { inline_keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v, callback_data: `add_y_v_${v}` }]) };
        await clearAndSend(chatId, "Yotoq kiritmoqchi boʻlgan Viloyatingizdi tanlang:", kb);
      }
      else if (text === "🗑️ Yotoqni o'chirish") {
        pushState(chatId, 'ST_DEL_Y_V');
        const kb = { inline_keyboard: Object.keys(db.hostel_structure).map(v => [{ text: v, callback_data: `del_y_v_${v}` }]) };
        await clearAndSend(chatId, "Oʻchirilishi kerak boʻlgan Yotoqning Viloyatini tanlang:", kb);
      }
    }
    else if (state === 'ST_ADD_V') {
      if (!db.hostel_structure[text]) db.hostel_structure[text] = {};
      saveDB(); popState(chatId);
      await clearAndSend(chatId, "✅ Viloyat qo'shildi.", { keyboard: [[{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true });
    }
    else if (state === 'ST_ADD_F_NAME') {
      const v = sessions[chatId].tempV;
      if (!db.hostel_structure[v][text]) db.hostel_structure[v][text] = {};
      saveDB(); popState(chatId); popState(chatId);
      await clearAndSend(chatId, "✅ Filial qo'shildi.", { keyboard: [[{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true });
    }
    else if (state === 'ST_ADD_X_NAME') {
      const v = sessions[chatId].tempV;
      const f = sessions[chatId].tempF;
      if (!db.hostel_structure[v][f][text]) db.hostel_structure[v][f][text] = {};
      saveDB(); popState(chatId); popState(chatId);
      await clearAndSend(chatId, "✅ Xona qo'shildi.", { keyboard: [[{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true });
    }
    else if (state === 'ST_ADD_Y_NAME') {
      sessions[chatId].tempY = text;
      pushState(chatId, 'ST_ADD_Y_PRICE');
      await clearAndSend(chatId, "Qo'shilgan yotoq joyning Oylik narxini Raqamlar bilan yozib chatga yuboring:", backKeyboard);
    }
    else if (state === 'ST_ADD_Y_PRICE') {
      const v = sessions[chatId].tempV;
      const f = sessions[chatId].tempF;
      const x = sessions[chatId].tempX;
      const y = sessions[chatId].tempY;
      db.hostel_structure[v][f][x][y] = { price: parseMoney(text), isFree: true };
      saveDB(); popState(chatId); popState(chatId); popState(chatId);
      await clearAndSend(chatId, "✅ Yotoq narxi bilan qo'shildi va bazada muxirlandi.", { keyboard: [[{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true });
    }

    // --- HOSTEL INTRO UCHUN XABARLAR ---
    if (state === 'ADMIN_WAIT_INTRO_MSG') {
      const f = sessions[chatId].tempIntroFilial;
      if (text === "✅ Yakunlash") {
        popState(chatId);
        await clearAndSend(chatId, "✅ Tanishtiruv ma'lumotlari muvaffaqiyatli saqlandi.", adminMainKeyboard);
      } else {
        if (!db.hostel_intro[f]) db.hostel_intro[f] = [];
        db.hostel_intro[f].push({ type: 'text', content: text });
        saveDB();
      }
    }

    // --- ESLATMA KIRITISH MANTIQI ---
    if (state.startsWith('WAIT_ESLATMA_')) {
      const uid = state.split('_')[2];
      if (text !== "✅ Qoldirish") db.kvartirantlar[uid].eslatma = text;
      saveDB();

      const kv = db.kvartirantlar[uid];
      const targetGroup = db.settings.Aktiv_Guruh;
      
      if (targetGroup) {
        const t = `1.Selfi Rasm\n✅ AKTIV  KVARTIRANT\n\n👤 (F.I.SH) : ${kv.fish}\n📅 Tugʻilgan sanasi : ${kv.birth}\n🪪 Pasport Seriyasi : ${kv.passport}\n🆔 JSHSHIR Raqami : ${kv.jshshir}\n📞 Tel Raqami: ${kv.phone}\n🚩 Viloyat : ${kv.viloyat}\n🏨 Filial : ${kv.filial}\n🚪 Xona : ${kv.xona}\n🛏 Yotoq : ${kv.yotoq}\n📅 Ijara Muddati : ${kv.muddati}\n📌 Eslatma : ${kv.eslatma}`;
        const mkp = { inline_keyboard: [[{ text: "👤Telegram Profili", url: `tg://user?id=${uid}` }], [{ text: "📌 Eslatma kiritish", callback_data: `note_${uid}` }, { text: "❌ Kvartirant ketgan", callback_data: `exit_${uid}` }]] };
        
        try {
          const sent = await bot.sendPhoto(targetGroup, kv.selfiePhoto, { caption: t, reply_markup: mkp });
          db.kvartirantlar[uid].groupMsgId = sent.message_id;
          saveDB();
        } catch(e){}
      }
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "✅ Kvartirant /aktiv bazasiga joylandi.", adminMainKeyboard);
    }
    
    // --- GURUHDAN ESLATMA KIRITISH ---
    if (state.startsWith('EDIT_NOTE_')) {
      const uid = state.split('_')[2];
      db.kvartirantlar[uid].eslatma = text;
      saveDB();

      const kv = db.kvartirantlar[uid];
      const grp = kv.status === 'aktiv' ? db.settings.Aktiv_Guruh : (kv.status === 'qarz' ? db.settings.Qarz_Guruh : db.settings.Ketgan_Guruh);
      
      if (grp && kv.groupMsgId) {
        let title = kv.status === 'aktiv' ? "✅ AKTIV  KVARTIRANT" : (kv.status === 'qarz' ? "⚠️ QARZDOR Kvartirant" : "⛔️ KETGAN Kvartirant");
        let dateLine = kv.status === 'arxiv' ? `📅 Kelgan muddati : ${formatDate(kv.joinDate)}\n📅 Ketgan muddati : ${formatDate(new Date())}` : `📅 Ijara Muddati : ${kv.muddati}`;
        if (kv.status === 'qarz') dateLine = `📅 Muddati tugagan : ${kv.muddati}`;

        const t = `1.Selfi Rasm\n${title}\n\n👤 (F.I.SH) : ${kv.fish}\n📅 Tugʻilgan sanasi : ${kv.birth}\n🪪 Pasport Seriyasi : ${kv.passport}\n🆔 JSHSHIR Raqami : ${kv.jshshir}\n📞 Tel Raqami: ${kv.phone}\n🚩 Viloyat : ${kv.viloyat}\n🏨 Filial : ${kv.filial}\n🚪 Xona : ${kv.xona}\n🛏 Yotoq : ${kv.yotoq}\n${dateLine}\n📌 Eslatma : ${kv.eslatma}`;
        let mkp = { inline_keyboard: [[{ text: "👤Telegram Profili", url: `tg://user?id=${uid}` }], [{ text: "📌 Eslatma kiritish", callback_data: `note_${uid}` }, { text: "❌ Kvartirant ketgan", callback_data: `exit_${uid}` }]] };
        if (kv.status === 'arxiv') mkp.inline_keyboard[1] = [{ text: "📌 Eslatma kiritish", callback_data: `note_${uid}` }, { text: "✅ AKTIV qilish", callback_data: `reactivate_${uid}` }];

        try { bot.editMessageCaption(t, { chat_id: grp, message_id: kv.groupMsgId, reply_markup: mkp }); } catch(e){}
      }
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "✅ Eslatma yozildi va omborda o'zgardi.", adminMainKeyboard);
    }
  }
});

// ------------------- RASMLAR ISHLOVCHISI -------------------
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) return;
  const state = sessions[chatId].state;
  const photoId = msg.photo[msg.photo.length - 1].file_id;

  if (state === 'REG_SELFIE') {
    sessions[chatId].regData.selfiePhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    pushState(chatId, 'REG_GENDER');
    await clearAndSend(chatId, "7. Jinsni belgilash:", genderKeyboard);
  }
  else if (state === 'REG_CHEK') {
    sessions[chatId].regData.chekPhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    await sendRequestToAdmins(chatId, true);
    sessions[chatId].state = 'MAIN_MENU'; saveSessions();
    await clearAndSend(chatId, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting", mainKeyboard);
  }
  else if (state === 'KVAR_CHEK') {
    sessions[chatId].renewData.chekPhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    await sendRenewRequestToAdmins(chatId, true);
    sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
    await clearAndSend(chatId, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting", kvartirantKeyboard);
  }
  else if (state === 'KVAR_MUROJAT') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    await sendMurojaatToAdmins(chatId, msg.caption || "Rasmli murojaat", photoId);
    sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
    await clearAndSend(chatId, "Murojaat yuborildi.", kvartirantKeyboard);
  }
  else if (state === 'ADMIN_WAIT_INTRO_MSG') {
    const f = sessions[chatId].tempIntroFilial;
    if (!db.hostel_intro[f]) db.hostel_intro[f] = [];
    db.hostel_intro[f].push({ type: 'photo', content: photoId, caption: msg.caption || "" });
    saveDB();
  }
});

// ------------------- INLINE TUGMALAR (CALLBACK) -------------------
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;

  // Tanishuv ko'rish
  if (data.startsWith('intro_')) {
    const f = data.replace('intro_', '');
    if (db.hostel_intro[f] && db.hostel_intro[f].length > 0) {
      for (const item of db.hostel_intro[f]) {
        if (item.type === 'text') await bot.sendMessage(chatId, item.content);
        if (item.type === 'photo') await bot.sendPhoto(chatId, item.content, { caption: item.caption });
      }
    } else {
      await bot.sendMessage(chatId, "Ushbu Filialga tanishish kiritilmagan");
    }
  }
  // Admin Filialga tanishuv kiritish
  else if (data.startsWith('setintro_')) {
    const f = data.replace('setintro_', '');
    sessions[chatId].tempIntroFilial = f;
    pushState(chatId, 'ADMIN_WAIT_INTRO_MSG');
    await clearAndSend(chatId, "Kiritmoqchi boʻlgan tanishtiruv Xabaringizni Chatga yuboring (Rasmlar, matnlar yuborishingiz mumkin. Tugatgach ✅ Yakunlash tugmasini bosing):", yakunlashKeyboard);
  }

  // --- STRUKTURA O'CHIRISH/TANLASH MANTIQI ---
  else if (data.startsWith('del_v_')) {
    const v = data.replace('del_v_', '');
    delete db.hostel_structure[v]; saveDB(); popState(chatId);
    await clearAndSend(chatId, "Viloyat barcha ma'lumotlari bilan tozalab tashlandi va Admindi bu haqida ogohlantiradi.", { keyboard: [[{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true });
  }
  else if (data.startsWith('add_f_v_')) {
    sessions[chatId].tempV = data.replace('add_f_v_', '');
    pushState(chatId, 'ST_ADD_F_NAME');
    await clearAndSend(chatId, "Iltimos Kiritmoqchi boʻlgan Filiall nomini chatga yozing:", backKeyboard);
  }
  else if (data.startsWith('del_f_v_')) {
    const v = data.replace('del_f_v_', '');
    const kb = { inline_keyboard: Object.keys(db.hostel_structure[v]).map(f => [{ text: f, callback_data: `del_f_${v}_${f}` }]) };
    await bot.editMessageText("Oʻchirish kerak boʻlgan Filiallini tanlang:", { chat_id: chatId, message_id: msgId, reply_markup: kb });
  }
  else if (data.startsWith('del_f_')) {
    const [, , v, f] = data.split('_');
    delete db.hostel_structure[v][f]; saveDB(); popState(chatId);
    await clearAndSend(chatId, "Filiall barcha ma'lumotlari bilan tozalab tashlandi va Admindi bu haqida ogohlantiradi.", { keyboard: [[{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true });
  }
  else if (data.startsWith('add_x_v_')) {
    const v = data.replace('add_x_v_', '');
    sessions[chatId].tempV = v;
    const kb = { inline_keyboard: Object.keys(db.hostel_structure[v]).map(f => [{ text: f, callback_data: `add_x_f_${f}` }]) };
    await bot.editMessageText("Xona kiritmoqchi boʻlgan Filialllingizdi tanlang:", { chat_id: chatId, message_id: msgId, reply_markup: kb });
  }
  else if (data.startsWith('add_x_f_')) {
    sessions[chatId].tempF = data.replace('add_x_f_', '');
    pushState(chatId, 'ST_ADD_X_NAME');
    await clearAndSend(chatId, "Iltimos Kiritmoqchi boʻlgan Xona nomini chatga yozing:", backKeyboard);
  }
  else if (data.startsWith('del_x_v_')) {
    const v = data.replace('del_x_v_', '');
    const kb = { inline_keyboard: Object.keys(db.hostel_structure[v]).map(f => [{ text: f, callback_data: `del_x_f_${v}_${f}` }]) };
    await bot.editMessageText("Oʻchirish kerak boʻlgan Xonaning Filiallini tanlang:", { chat_id: chatId, message_id: msgId, reply_markup: kb });
  }
  else if (data.startsWith('del_x_f_')) {
    const [, , , v, f] = data.split('_');
    const kb = { inline_keyboard: Object.keys(db.hostel_structure[v][f]).map(x => [{ text: x, callback_data: `del_x_${v}_${f}_${x}` }]) };
    await bot.editMessageText("Oʻchirish kerak boʻlgan Xonani tanlang:", { chat_id: chatId, message_id: msgId, reply_markup: kb });
  }
  else if (data.startsWith('del_x_')) {
    const p = data.split('_'); const v = p[2], f = p[3], x = p[4];
    delete db.hostel_structure[v][f][x]; saveDB(); popState(chatId);
    await clearAndSend(chatId, "Xona barcha ma'lumotlari bilan tozalab tashlandi va Admindi bu haqida ogohlantiradi.", { keyboard: [[{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true });
  }
  else if (data.startsWith('add_y_v_')) {
    const v = data.replace('add_y_v_', '');
    sessions[chatId].tempV = v;
    const kb = { inline_keyboard: Object.keys(db.hostel_structure[v]).map(f => [{ text: f, callback_data: `add_y_f_${f}` }]) };
    await bot.editMessageText("Yotoq kiritmoqchi boʻlgan Filialllingizdi tanlang:", { chat_id: chatId, message_id: msgId, reply_markup: kb });
  }
  else if (data.startsWith('add_y_f_')) {
    const f = data.replace('add_y_f_', '');
    sessions[chatId].tempF = f;
    const kb = { inline_keyboard: Object.keys(db.hostel_structure[sessions[chatId].tempV][f]).map(x => [{ text: x, callback_data: `add_y_x_${x}` }]) };
    await bot.editMessageText("Yotoq kiritmoqchi boʻlgan Xonani tanlang:", { chat_id: chatId, message_id: msgId, reply_markup: kb });
  }
  else if (data.startsWith('add_y_x_')) {
    sessions[chatId].tempX = data.replace('add_y_x_', '');
    pushState(chatId, 'ST_ADD_Y_NAME');
    await clearAndSend(chatId, "Iltimos Kiritmoqchi boʻlgan Yotoq nomini chatga yozing:", backKeyboard);
  }
  else if (data.startsWith('del_y_v_')) {
    const v = data.replace('del_y_v_', '');
    const kb = { inline_keyboard: Object.keys(db.hostel_structure[v]).map(f => [{ text: f, callback_data: `del_y_f_${v}_${f}` }]) };
    await bot.editMessageText("Oʻchirish kerak boʻlgan Yotoqning Filiallini tanlang:", { chat_id: chatId, message_id: msgId, reply_markup: kb });
  }
  else if (data.startsWith('del_y_f_')) {
    const [, , , v, f] = data.split('_');
    const kb = { inline_keyboard: Object.keys(db.hostel_structure[v][f]).map(x => [{ text: x, callback_data: `del_y_x_${v}_${f}_${x}` }]) };
    await bot.editMessageText("Oʻchirish kerak boʻlgan Yotoq Xonasini tanlang:", { chat_id: chatId, message_id: msgId, reply_markup: kb });
  }
  else if (data.startsWith('del_y_x_')) {
    const p = data.split('_'); const v = p[3], f = p[4], x = p[5];
    const kb = { inline_keyboard: Object.keys(db.hostel_structure[v][f][x]).map(y => [{ text: y, callback_data: `del_y_fin_${v}_${f}_${x}_${y}` }]) };
    await bot.editMessageText("Oʻchirish kerak boʻlgan Yotoqni tanlang:", { chat_id: chatId, message_id: msgId, reply_markup: kb });
  }
  else if (data.startsWith('del_y_fin_')) {
    const p = data.split('_'); const v = p[3], f = p[4], x = p[5], y = p[6];
    if (db.hostel_structure[v][f][x][y] && db.hostel_structure[v][f][x][y].isFree === false) {
      return await bot.answerCallbackQuery(query.id, { text: "Yotoqda odam bor Rad etildi!", show_alert: true });
    }
    delete db.hostel_structure[v][f][x][y]; saveDB(); popState(chatId);
    await clearAndSend(chatId, "Yotoq barcha ma'lumotlari bilan tozalab tashlandi va Admindi bu haqida ogohlantiradi.", { keyboard: [[{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true });
  }

  // --- ARIZA/TO'LOV TASDIQLASH MANTIQI ---
  else if (data.startsWith('reg_yes_')) {
    const uid = data.split('_')[2];
    const rd = sessions[uid]?.regData;
    if (rd) {
      db.kvartirantlar[uid] = { ...rd, status: 'aktiv', eslatma: "Mavjud emas", joinDate: new Date() };
      if (db.hostel_structure[rd.viloyat][rd.filial][rd.xona][rd.yotoq]) db.hostel_structure[rd.viloyat][rd.filial][rd.xona][rd.yotoq].isFree = false;
      saveDB();
      try { await bot.deleteMessage(chatId, msgId); } catch(e){} // Faqatgina ushbu xabar o'chadi
      bot.sendMessage(uid, "Arizangiz qabul qilindi! /start ni bosing.");
      
      pushState(chatId, `WAIT_ESLATMA_${uid}`);
      await bot.sendMessage(chatId, "ushbu foydalanuvchi maʼlumotlari yoniga Eslatma maʼlumot qoʻshib qoʻyasizmi...", { reply_markup: qoldirishKeyboard });
    }
  }
  else if (data.startsWith('reg_no_')) {
    const uid = data.split('_')[2];
    try { await bot.deleteMessage(chatId, msgId); } catch(e){} // Faqatgina ushbu xabar o'chadi
    bot.sendMessage(uid, "Arizangiz rad etildi.");
  }
  else if (data.startsWith('ren_yes_')) {
    const uid = data.split('_')[2];
    const rn = sessions[uid]?.renewData;
    if (rn && db.kvartirantlar[uid]) {
      db.kvartirantlar[uid].muddati = rn.muddati;
      db.kvartirantlar[uid].status = 'aktiv';
      saveDB();
      try { await bot.deleteMessage(chatId, msgId); } catch(e){} // Faqatgina ushbu xabar o'chadi
      bot.sendMessage(uid, "To'lov tasdiqlandi. Muddat uzaytirildi.");
      pushState(chatId, `WAIT_ESLATMA_${uid}`);
      await bot.sendMessage(chatId, "ushbu foydalanuvchi maʼlumotlari yoniga Eslatma maʼlumot qoʻshib qoʻyasizmi...", { reply_markup: qoldirishKeyboard });
    }
  }
  else if (data.startsWith('ren_no_')) {
    const uid = data.split('_')[2];
    try { await bot.deleteMessage(chatId, msgId); } catch(e){} // Faqatgina ushbu xabar o'chadi
    bot.sendMessage(uid, "To'lov rad etildi.");
  }

  // --- MUROJAAT ---
  else if (data === 'mur_ok') {
    try { await bot.deleteMessage(chatId, msgId); } catch(e){}
                       }

         // --- GURUHDAGI INLINE TUGMALAR ---
  else if (data.startsWith('note_')) {
    const uid = data.split('_')[1];
    pushState(query.from.id, `EDIT_NOTE_${uid}`);
    bot.sendMessage(query.from.id, "Kiritmoqchi boʻlgan 📌 Eslatma xabaringizni Chatga yozib yuboring", { reply_markup: backKeyboard });
    bot.answerCallbackQuery(query.id, { text: "Bot lichkasiga o'ting." });
  }
  else if (data.startsWith('exit_')) {
    const uid = data.split('_')[1];
    const kv = db.kvartirantlar[uid];
    if (kv) {
      if (kv.groupMsgId) {
        const oGrp = kv.status === 'aktiv' ? db.settings.Aktiv_Guruh : db.settings.Qarz_Guruh;
        try { await bot.deleteMessage(oGrp, kv.groupMsgId); } catch(e){}
      }
      if (db.hostel_structure[kv.viloyat][kv.filial][kv.xona][kv.yotoq]) db.hostel_structure[kv.viloyat][kv.filial][kv.xona][kv.yotoq].isFree = true;
      kv.status = 'arxiv'; saveDB();

      if (db.settings.Ketgan_Guruh) {
        const t = `1.Selfi Rasm\n⛔️ KETGAN Kvartirant\n\n👤 (F.I.SH) : ${kv.fish}\n📅 Tugʻilgan sanasi : ${kv.birth}\n🪪 Pasport Seriyasi : ${kv.passport}\n🆔 JSHSHIR Raqami : ${kv.jshshir}\n📞 Tel Raqami: ${kv.phone}\n🚩 Viloyat : ${kv.viloyat}\n🏨 Filial : ${kv.filial}\n🚪 Xona : ${kv.xona}\n🛏 Yotoq : ${kv.yotoq}\n📅 Kelgan muddati : ${formatDate(kv.joinDate)}\n📅 Ketgan muddati : ${formatDate(new Date())}\n📌 Eslatma : ${kv.eslatma}`;
        const mkp = { inline_keyboard: [[{ text: "👤Telegram Profili", url: `tg://user?id=${uid}` }], [{ text: "📌 Eslatma kiritish", callback_data: `note_${uid}` }, { text: "✅ AKTIV qilish", callback_data: `reactivate_${uid}` }]] };
        try { const sm = await bot.sendPhoto(db.settings.Ketgan_Guruh, kv.selfiePhoto, { caption: t, reply_markup: mkp }); kv.groupMsgId = sm.message_id; saveDB(); } catch(e){}
      }
    }
  }
});

// ------------------- YUBORISH MANTIQI -------------------
async function sendRequestToAdmins(uid, hasChek) {
  const r = sessions[uid].regData;
  let t = `🔔YANGI KVARTIRANT TOʻLOVI\n\n💵 Toʻlov turi : ${r.payType}\n🤝 Summa: ${r.summa}\n👤 (F.I.SH) : ${r.fish}\n📅 Tugʻilgan sanasi : ${r.birth}\n🪪 Pasport Seriyasi : ${r.passport}\n🆔 JSHSHIR Raqami : ${r.jshshir}\n📞 Tel Raqami: ${r.phone}\n🚩 Viloyat : ${r.viloyat}\n🏨 Filial : ${r.filial}\n🚪 Xona : ${r.xona}\n🛏 Yotoq : ${r.yotoq}\n📅 Ijara Muddati : ${r.muddati}\n📌 Eslatma : Kiritilmagan`;
  if (!hasChek) t += `\n\n😎 Pulni Qoʻlingizga olgandan soʻng 🤝\n✅ Tasdiqlang...❕`;

  const mkp = { inline_keyboard: [[{ text: "👤Telegram Profili", url: `tg://user?id=${uid}` }], [{ text: "✅ Tasdiqlash", callback_data: `reg_yes_${uid}` }, { text: "❌ Rad etish", callback_data: `reg_no_${uid}` }]] };

  for (let adm of db.admins) {
    try {
      if (hasChek) {
        await bot.sendPhoto(adm, r.selfiePhoto, { caption: "1.Selfi Rasm" });
        await bot.sendPhoto(adm, r.chekPhoto, { caption: "2.Chek Rasm\n" + t, reply_markup: mkp });
      } else {
        await bot.sendPhoto(adm, r.selfiePhoto, { caption: "1.Selfi Rasm\n" + t, reply_markup: mkp });
      }
    } catch(e){}
  }
}

async function sendRenewRequestToAdmins(uid, hasChek) {
  const rn = sessions[uid].renewData;
  const kv = db.kvartirantlar[uid];
  let t = `🔔HOSTEL KVARTIRANTI TOʻLOVI\n\n💵 Toʻlov turi : ${rn.payType}\n🤝 Summa: ${rn.summa}\n👤 (F.I.SH) : ${kv.fish}\n📅 Tugʻilgan sanasi : ${kv.birth}\n🪪 Pasport Seriyasi : ${kv.passport}\n🆔 JSHSHIR Raqami : ${kv.jshshir}\n📞 Tel Raqami: ${kv.phone}\n🚩 Viloyat : ${kv.viloyat}\n🏨 Filial : ${kv.filial}\n🚪 Xona : ${kv.xona}\n🛏 Yotoq : ${kv.yotoq}\n📅 Ijara Muddati : ${rn.muddati}\n📌 Eslatma : ${kv.eslatma}`;
  if (!hasChek) t += `\n\n😎 Pulni Qoʻlingizga olgandan soʻng 🤝\n✅ Tasdiqlang...❕`;

  const mkp = { inline_keyboard: [[{ text: "👤Telegram Profili", url: `tg://user?id=${uid}` }], [{ text: "✅ Tasdiqlash", callback_data: `ren_yes_${uid}` }, { text: "❌ Rad etish", callback_data: `ren_no_${uid}` }]] };

  for (let adm of db.admins) {
    try {
      if (hasChek) {
        await bot.sendPhoto(adm, kv.selfiePhoto, { caption: "1.Selfi Rasm" });
        await bot.sendPhoto(adm, rn.chekPhoto, { caption: "2.Chek Rasm\n" + t, reply_markup: mkp });
      } else {
        await bot.sendPhoto(adm, kv.selfiePhoto, { caption: "1.Selfi Rasm\n" + t, reply_markup: mkp });
      }
    } catch(e){}
  }
}

async function sendMurojaatToAdmins(uid, txt, pId) {
  const kv = db.kvartirantlar[uid];
  let t = `📨 MUROJAT NOMA\n\n👤 (F.I.SH) : ${kv.fish}\n📅 Tugʻilgan sanasi : ${kv.birth}\n🪪 Pasport Seriyasi : ${kv.passport}\n🆔 JSHSHIR Raqami : ${kv.jshshir}\n📞 Tel Raqami: ${kv.phone}\n🚩 Viloyat : ${kv.viloyat}\n🏨 Filial : ${kv.filial}\n🚪 Xona : ${kv.xona}\n🛏 Yotoq : ${kv.yotoq}\n📅 Ijara Muddati : ${kv.muddati}\n📌 Eslatma : ${kv.eslatma}\n📨 Murojat noma : ${txt}`;
  const mkp = { inline_keyboard: [[{ text: "👤Telegram Profili", url: `tg://user?id=${uid}` }], [{ text: "✅ Murojat noma qabul qilindi", callback_data: `mur_ok` }]] };

  for (let adm of db.admins) {
    try {
      if (pId) {
        await bot.sendPhoto(adm, kv.selfiePhoto, { caption: "1.Selfi Rasm" });
        await bot.sendPhoto(adm, pId, { caption: t, reply_markup: mkp });
      } else {
        await bot.sendPhoto(adm, kv.selfiePhoto, { caption: "1.Selfi Rasm\n" + t, reply_markup: mkp });
      }
    } catch(e){}
  }
}

// ------------------- CRON: QARZDORLIK -------------------
cron.schedule('0 9,14,20 * * *', async () => {
  const now = new Date();
  for (let uid in db.kvartirantlar) {
    const kv = db.kvartirantlar[uid];
    if (kv.status !== 'aktiv' && kv.status !== 'qarz') continue;
    const [d, m, y] = kv.muddati.split('.');
    const exp = new Date(y, m - 1, d);
    const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

    if (diff <= 3 && diff > 0) {
      bot.sendMessage(uid, `⚠️ Muddatingiz tugashiga ${diff} kun qoldi.`).catch(()=>{});
    } else if (diff <= 0 && kv.status === 'aktiv') {
      if (db.settings.Aktiv_Guruh && kv.groupMsgId) try { await bot.deleteMessage(db.settings.Aktiv_Guruh, kv.groupMsgId); } catch(e){}
      kv.status = 'qarz'; saveDB();
      bot.sendMessage(uid, "⚠️ Muddatingiz tugadi, QARZDORSIZ.").catch(()=>{});
      
      if (db.settings.Qarz_Guruh) {
        const t = `1.Selfi Rasm\n⚠️ QARZDOR Kvartirant\n\n👤 (F.I.SH) : ${kv.fish}\n📅 Tugʻilgan sanasi : ${kv.birth}\n🪪 Pasport Seriyasi : ${kv.passport}\n🆔 JSHSHIR Raqami : ${kv.jshshir}\n📞 Tel Raqami: ${kv.phone}\n🚩 Viloyat : ${kv.viloyat}\n🏨 Filial : ${kv.filial}\n🚪 Xona : ${kv.xona}\n🛏 Yotoq : ${kv.yotoq}\n📅 Muddati tugagan : ${kv.muddati}\n📌 Eslatma : ${kv.eslatma}`;
        const mkp = { inline_keyboard: [[{ text: "👤Telegram Profili", url: `tg://user?id=${uid}` }], [{ text: "📌 Eslatma kiritish", callback_data: `note_${uid}` }, { text: "❌ Kvartirant ketgan", callback_data: `exit_${uid}` }]] };
        try { const sm = await bot.sendPhoto(db.settings.Qarz_Guruh, kv.selfiePhoto, { caption: t, reply_markup: mkp }); kv.groupMsgId = sm.message_id; saveDB(); } catch(e){}
      }
    }
  }
});
