const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Tinchlik Hostel Bot faol va ishlamoqda!');
});

app.listen(PORT, () => {
  console.log(`Veb-server ${PORT}-portda muvaffaqiyatli tinglamoqda.`);
});

// ------------------- SOZLAMALAR VA TOKENLAR -------------------
const TOKEN = process.env.BOT_TOKEN || '8949142604:AAGqrksBXzXZqOiBPIP0EWLHFJPpSX9Tlmk';
const MAIN_SUPER_ADMIN = 8485164743; 

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
  hostel_structure: {}, 
  kvartirantlar: {},    
  archive: []           
};

let sessions = {};

// Ma'lumotlarni yuklash va fayl buzilishining oldini olish
if (fs.existsSync(DB_FILE)) {
  try { 
    const rawDB = fs.readFileSync(DB_FILE, 'utf8');
    if (rawDB.trim()) db = JSON.parse(rawDB); 
  } catch (e) { 
    console.error("⚠️ Baza faylini o'qishda xato, qayta tiklanmoqda...", e); 
  }
} else {
  saveDB();
}

if (fs.existsSync(SESSION_FILE)) {
  try { 
    const rawSessions = fs.readFileSync(SESSION_FILE, 'utf8');
    if (rawSessions.trim()) sessions = JSON.parse(rawSessions); 
  } catch (e) { 
    console.error("⚠️ Sessiya faylini o'qishda xato...", e); 
  }
} else {
  saveSessions();
}

function saveDB() { 
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); } catch (err) { console.error("❌ DB yozishda xato:", err); }
}

function saveSessions() { 
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf8'); } catch (err) { console.error("❌ Sessiya yozishda xato:", err); }
}

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

// Chat xabarlarini boshqarish va tozalash
async function clearAndSend(chatId, text, replyMarkup) {
  if (!sessions[chatId]) sessions[chatId] = { history: [], lastMessageIds: [] };
  if (!sessions[chatId].lastMessageIds) sessions[chatId].lastMessageIds = [];

  for (let msgId of sessions[chatId].lastMessageIds) {
    try { await bot.deleteMessage(chatId, msgId); } catch (e) {}
  }
  sessions[chatId].lastMessageIds = [];

  try {
    const sentMsg = await bot.sendMessage(chatId, text, { reply_markup: replyMarkup, parse_mode: 'HTML' });
    sessions[chatId].lastMessageIds.push(sentMsg.message_id);
    saveSessions();
  } catch (e) {
    console.error(`❌ Chat ${chatId} ga xabar yuborilmadi:`, e);
  }
}

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
  sessions[chatId].history.pop(); 
  return sessions[chatId].history[sessions[chatId].history.length - 1] || 'MAIN_MENU';
}

// ------------------- KLAVIATURALAR -------------------
const mainKeyboard = {
  keyboard: [[{ text: "👤 Roʻyxatdan oʻtish" }], [{ text: "🏨 HOSTEL bilan tanishish" }, { text: "🛂 HOSTEL Qoidalar" }]],
  resize_keyboard: true
};

const kvartirantKeyboard = {
  keyboard: [[{ text: "📅 Ijara Muddati" }, { text: "💵 Toʻlov qilish" }], [{ text: "💳 Karta Raqam" }, { text: "📜 Qoidalar" }], [{ text: "🛂 Adminga murojat yoʻllash" }]],
  resize_keyboard: true
};

const adminMainKeyboard = {
  keyboard: [[{ text: "📊 STATISTIKA" }, { text: "📜 Qoida sozlash" }], [{ text: "🏨 HOSTEL Sozlash" }, { text: "👮‍♂️ Admin qoʻshish" }], [{ text: "💳 Karta Sozlamalari" }, { text: "📢 Xabarnoma" }], [{ text: "🏨 HOSTEL tanishuv sozlamalari" }], [{ text: "⛅ KUNLIK Toʻlovni sozlash" }], [{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

const backKeyboard = { keyboard: [[{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true };
const genderKeyboard = { keyboard: [[{ text: "Erkak" }, { text: "Ayol" }], [{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true };
const paymentTypeKeyboard = { keyboard: [[{ text: "💳 Karta orqali" }, { text: "💵 Naqd pul bilan" }], [{ text: "⬅️ Ortga qaytish" }]], resize_keyboard: true };

// ------------------- BOT BUYRUQLARI -------------------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { history: [], lastMessageIds: sessions[chatId]?.lastMessageIds || [] };
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (db.kvartirantlar[chatId] && (db.kvartirantlar[chatId].status === 'aktiv' || db.kvartirantlar[chatId].status === 'qarz')) {
    const filial = db.kvartirantlar[chatId].filial || "HOSTEL";
    pushState(chatId, 'KVARTIRANT_MENU');
    await clearAndSend(chatId, `Assalomu alaykum <b>${filial}</b> Profilingizga xush kelibsiz...❕`, kvartirantKeyboard);
  } else {
    pushState(chatId, 'MAIN_MENU');
    await clearAndSend(chatId, "<b>Tinchlik HOSTEL</b> tizimiga xush kelibsiz! Quyidagi tugmalardan birini tanlang:", mainKeyboard);
  }
});

bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
  if (!db.admins.includes(chatId)) return bot.sendMessage(chatId, "Kechirasiz, sizda bunday huquq mavjud emas!");

  sessions[chatId] = { history: [], lastMessageIds: sessions[chatId]?.lastMessageIds || [] };
  pushState(chatId, 'ADMIN_MAIN');
  await clearAndSend(chatId, "👑 <b>Admin paneliga xush kelibsiz!</b>\nBarcha boshqaruv elementlari:", adminMainKeyboard);
});

bot.onText(/\/(aktiv|qarz|arxiv)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!db.admins.includes(msg.from.id)) return;
  const cmd = match[1];

  if (cmd === "aktiv") db.settings.Aktiv_Guruh = chatId;
  else if (cmd === "qarz") db.settings.Qarz_Guruh = chatId;
  else if (cmd === "arxiv") db.settings.Ketgan_Guruh = chatId;
  
  saveDB();
  await bot.sendMessage(chatId, `✅ Ushbu guruh muvaffaqiyatli sinxronizatsiya qilindi (${cmd.toUpperCase()}).`);
});

// ------------------- MATN VA PROCESSING -------------------
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;
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

  // MAIN MENU
  if (state === 'MAIN_MENU') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    if (text === "👤 Roʻyxatdan oʻtish") {
      pushState(chatId, 'REG_FISH');
      await clearAndSend(chatId, "1. Iltimos, Familiya Ism Sharifingizni (F.I.SH) kiriting:", backKeyboard);
    } else if (text === "🏨 HOSTEL bilan tanishish") {
      await clearAndSend(chatId, `🏨 <b>HOSTEL Haqida:</b>\n\n${db.settings.hostel_info}`, mainKeyboard);
    } else if (text === "🛂 HOSTEL Qoidalar") {
      await clearAndSend(chatId, `🛂 <b>HOSTEL Qoidalari:</b>\n\n${db.settings.hostel_rules}`, mainKeyboard);
    }
    return;
  }

  // REGISTRATION MACHINE
  if (state.startsWith('REG_')) {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    
    if (state === 'REG_FISH') {
      if (text.length < 5) return bot.sendMessage(chatId, "⚠️ Ism juda qisqa! To'liq F.I.SH kiriting:");
      sessions[chatId].regData = { fish: text };
      pushState(chatId, 'REG_BIRTHTIME');
      await clearAndSend(chatId, "2. Tugʻilgan sanangizni kiriting (Format: DD.MM.YYYY, masalan: 25.12.2000):", backKeyboard);
    } 
    else if (state === 'REG_BIRTHTIME') {
      if (!/^\d{2}\.\d{2}\.\d{4}$/.test(text)) return bot.sendMessage(chatId, "⚠️ Noto'g'ri format. DD.MM.YYYY ko'rinishida yozing:");
      sessions[chatId].regData.birth = text;
      pushState(chatId, 'REG_PHONE');
      await clearAndSend(chatId, "3. Telefon raqamingizni kiriting (+998901234567):", backKeyboard);
    } 
    else if (state === 'REG_PHONE') {
      if (!/^\+?\d{9,12}$/.test(text)) return bot.sendMessage(chatId, "⚠️ Telefon raqam xato. Qayta urinib ko'ring:");
      sessions[chatId].regData.phone = text;
      pushState(chatId, 'REG_PASSPORT');
      await clearAndSend(chatId, "4. Pasport Seriya va Raqamini kiriting (Masalan: AD1234567):", backKeyboard);
    } 
    else if (state === 'REG_PASSPORT') {
      if (text.length < 7) return bot.sendMessage(chatId, "⚠️ Pasport seriyasi xato. To'g'ri kiriting:");
      sessions[chatId].regData.passport = text.toUpperCase();
      pushState(chatId, 'REG_JSHSHIR');
      await clearAndSend(chatId, "5. Pasportdagi 14 xonali JSHSHIR raqamingizni kiriting:", backKeyboard);
    } 
    else if (state === 'REG_JSHSHIR') {
      if (!/^\d{14}$/.test(text)) return bot.sendMessage(chatId, "⚠️ JSHSHIR 14 ta raqamdan iborat bo'lishi shart:");
      sessions[chatId].regData.jshshir = text;
      pushState(chatId, 'REG_SELFIE');
      await clearAndSend(chatId, "6. Yuzingiz aniq koʻringan Selfi Rasmingizni yuklang (Faqat rasm formatida):", backKeyboard);
    } 
    else if (state === 'REG_GENDER') {
      if (text === "Erkak" || text === "Ayol") {
        sessions[chatId].regData.gender = text;
        pushState(chatId, 'REG_CHOOSE_VILOYAT');
        const viloyatlar = Object.keys(db.hostel_structure || {});
        if (viloyatlar.length === 0) {
          sessions[chatId].state = 'MAIN_MENU';
          return await clearAndSend(chatId, "⚠️ Tizimda hali viloyatlar sozlanmagan.", mainKeyboard);
        }
        const kbd = { keyboard: viloyatlar.map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "7. Viloyatni tanlang:", kbd);
      } else {
        return bot.sendMessage(chatId, "Iltimos, tugmalardan birini bosing!");
      }
    }
    else if (state === 'REG_CHOOSE_VILOYAT') {
      if (db.hostel_structure?.[text]) {
        sessions[chatId].regData.viloyat = text;
        pushState(chatId, 'REG_CHOOSE_FILIAL');
        const filiallar = Object.keys(db.hostel_structure[text] || {});
        if (filiallar.length === 0) return bot.sendMessage(chatId, "Ushbu viloyatda filiallar yo'q.");
        const kbd = { keyboard: filiallar.map(f => [{ text: f }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Filialni tanlang:", kbd);
      }
    }
    else if (state === 'REG_CHOOSE_FILIAL') {
      const vil = sessions[chatId].regData.viloyat;
      if (db.hostel_structure?.[vil]?.[text]) {
        sessions[chatId].regData.filial = text;
        pushState(chatId, 'REG_CHOOSE_XONA');
        const xonalar = Object.keys(db.hostel_structure[vil][text] || {});
        const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Xonani tanlang:", kbd);
      }
    }
    else if (state === 'REG_CHOOSE_XONA') {
      const vil = sessions[chatId].regData.viloyat;
      const fil = sessions[chatId].regData.filial;
      if (db.hostel_structure?.[vil]?.[fil]?.[text]) {
        sessions[chatId].regData.xona = text;
        pushState(chatId, 'REG_CHOOSE_YOTOQ');
        const barchaYotoqlar = db.hostel_structure[vil][fil][text] || {};
        const boShYotoqlar = Object.keys(barchaYotoqlar).filter(y => barchaYotoqlar[y].isFree);
        
        if (boShYotoqlar.length === 0) return bot.sendMessage(chatId, "Kechirasiz, xonada bo'sh joy qolmagan.");
        const kbd = { keyboard: boShYotoqlar.map(y => [{ text: y }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Boʻsh yotoqni tanlang:", kbd);
      }
    }
    else if (state === 'REG_CHOOSE_YOTOQ') {
      const vil = sessions[chatId].regData.viloyat;
      const fil = sessions[chatId].regData.filial;
      const xon = sessions[chatId].regData.xona;
      if (db.hostel_structure?.[vil]?.[fil]?.[xon]?.[text]) {
        if (!db.hostel_structure[vil][fil][xon][text].isFree) return bot.sendMessage(chatId, "Bu joy band qilindi!");
        sessions[chatId].regData.yotoq = text;
        const oylikNarx = db.hostel_structure[vil][fil][xon][text].price || 0;
        sessions[chatId].regData.pricePerMonth = oylikNarx;

        pushState(chatId, 'REG_CHOOSE_DURATION');
        const durationKbd = {
          keyboard: [[{ text: "Oylik Toʻlov" }], [{ text: "1 kunlik" }, { text: "3 kunlik" }, { text: "7 kunlik" }], [{ text: "⬅️ Ortga qaytish" }]],
          resize_keyboard: true
        };
        await clearAndSend(chatId, `Oylik tarif: <b>${formatMoney(oylikNarx)}</b>\nKunlik tarif: <b>${formatMoney(db.settings.daily_price)}</b>\n\nIjara muddatini tanlang:`, durationKbd);
      }
    }
    else if (state === 'REG_CHOOSE_DURATION') {
      let totalSum = 0;
      let endDate = new Date();

      if (text === "Oylik Toʻlov") {
        totalSum = sessions[chatId].regData.pricePerMonth;
        endDate.setMonth(endDate.getMonth() + 1); 
        sessions[chatId].regData.durType = "Oylik";
      } else {
        const kunMatch = text.match(/(\d+)/);
        if (kunMatch) {
          const kunlar = parseInt(kunMatch[1], 10);
          totalSum = kunlar * db.settings.daily_price;
          endDate.setDate(endDate.getDate() + kunlar);
          sessions[chatId].regData.durType = `${kunlar} kunlik`;
        } else {
          return bot.sendMessage(chatId, "Tugmalardan foydalaning!");
        }
      }
      sessions[chatId].regData.muddati = formatDate(endDate);
      sessions[chatId].regData.summa = totalSum;

      pushState(chatId, 'REG_PAYMENT_TYPE');
      await clearAndSend(chatId, `Summa: <b>${formatMoney(totalSum)}</b>\nMuddat: <b>${sessions[chatId].regData.muddati}</b>\n\nToʻlov turi:`, paymentTypeKeyboard);
    }
    else if (state === 'REG_PAYMENT_TYPE') {
      if (text === "💳 Karta orqali") {
        sessions[chatId].regData.payType = "💳 Karta orqali";
        pushState(chatId, 'REG_SEND_CHEK');
        await clearAndSend(chatId, `Karta: <code>${db.settings.card_number}</code>\nEga: <b>${db.settings.card_owner}</b>\n\nTo'lov cheki rasmini yuklang:`, backKeyboard);
      } else if (text === "💵 Naqd pul bilan") {
        sessions[chatId].regData.payType = "💵 Naqd pul bilan";
        await sendRequestToAdmins(chatId, false);
        sessions[chatId].state = 'MAIN_MENU'; saveSessions();
        await clearAndSend(chatId, "Soʻrov yuborildi. Naqd to'lov qilingach profilingiz faollashadi.", mainKeyboard);
      }
    }
    return;
  }

  // KVARTIRANT OPERATIONS
  if (state === 'KVARTIRANT_MENU') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const kv = db.kvartirantlar[chatId];
    if (!kv) { sessions[chatId].state = 'MAIN_MENU'; return await clearAndSend(chatId, "Profil topilmadi.", mainKeyboard); }

    if (text === "📅 Ijara Muddati") {
      await clearAndSend(chatId, `📅 <b>Ijara muddatingiz:</b> ${kv.muddati}gacha.`, kvartirantKeyboard);
    } else if (text === "💵 Toʻlov qilish") {
      pushState(chatId, 'KVAR_PAY_DURATION');
      const durationKbd = {
        keyboard: [[{ text: "Oylik Toʻlov" }], [{ text: "1 kunlik" }, { text: "3 kunlik" }], [{ text: "⬅️ Ortga qaytish" }]],
        resize_keyboard: true
      };
      await clearAndSend(chatId, "Uzatish muddatini belgilang:", durationKbd);
    } else if (text === "💳 Karta Raqam") {
      await clearAndSend(chatId, `💳 <b>Rekvizitlar:</b>\n\n<code>${db.settings.card_number}</code>\n<b>${db.settings.card_owner}</b>`, kvartirantKeyboard);
    } else if (text === "📜 Qoidalar") {
      await clearAndSend(chatId, `🛂 <b>Qoidalar:</b>\n\n${db.settings.hostel_rules}`, kvartirantKeyboard);
    } else if (text === "🛂 Adminga murojat yoʻllash") {
      pushState(chatId, 'KVAR_SEND_MUROJAAT');
      await clearAndSend(chatId, "Murojaatingizni yozing yoki muammo rasmini yuklang:", backKeyboard);
    }
    return;
  }

  if (state === 'KVAR_PAY_DURATION') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const kv = db.kvartirantlar[chatId];
    let totalSum = 0;
    let currentExpDate = new Date();

    if (kv?.muddati) {
      const parts = kv.muddati.split('.');
      if (parts.length === 3) {
        const parsed = new Date(parts[2], parts[1] - 1, parts[0]);
        if (parsed > currentExpDate) currentExpDate = parsed;
      }
    }

    if (text === "Oylik Toʻlov") {
      totalSum = kv.pricePerMonth || db.settings.daily_price * 30;
      currentExpDate.setMonth(currentExpDate.getMonth() + 1);
      sessions[chatId].renewData = { durType: "Oylik", summa: totalSum, muddati: formatDate(currentExpDate) };
    } else {
      const kunMatch = text.match(/(\d+)/);
      if (kunMatch) {
        const kunlar = parseInt(kunMatch[1], 10);
        totalSum = kunlar * db.settings.daily_price;
        currentExpDate.setDate(currentExpDate.getDate() + kunlar);
        sessions[chatId].renewData = { durType: `${kunlar} kunlik`, summa: totalSum, muddati: formatDate(currentExpDate) };
      } else {
        return bot.sendMessage(chatId, "Tugmalardan foydalaning!");
      }
    }

    pushState(chatId, 'KVAR_PAY_TYPE');
    await clearAndSend(chatId, `Yangi muddat: <b>${sessions[chatId].renewData.muddati}</b>\nSumma: <b>${formatMoney(totalSum)}</b>\nTo'lov turi:`, paymentTypeKeyboard);
    return;
  }

  if (state === 'KVAR_PAY_TYPE') {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    if (text === "💳 Karta orqali") {
      sessions[chatId].renewData.payType = "💳 Karta orqali";
      pushState(chatId, 'KVAR_SEND_CHEK');
      await clearAndSend(chatId, "To'lov chekini rasm formatida yuboring:", backKeyboard);
    } else if (text === "💵 Nadminsaqd pul bilan") {
      sessions[chatId].renewData.payType = "💵 Naqd pul bilan";
      await sendRenewRequestToAdmins(chatId, false);
      sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
      await clearAndSend(chatId, "Uzatish so'rovi adminga yuborildi.", kvartirantKeyboard);
    }
    return;
  }

  // ADMIN CONTROL PANEL
  if (db.admins.includes(chatId) && state.startsWith('ADMIN_')) {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

    if (state === 'ADMIN_MAIN') {
      if (text === "📊 STATISTIKA") {
        let aktivlar = 0, erkaklar = 0, ayollar = 0, qarzdorlar = 0, qarzSumma = 0;
        let boshYotoqlar = 0;

        Object.values(db.kvartirantlar).forEach(k => {
          if (k.status === 'aktiv') {
            aktivlar++;
            if (k.gender === 'Erkak') erkaklar++;
            if (k.gender === 'Ayol') ayollar++;
          }
          if (k.status === 'qarz') { qarzdorlar++; qarzSumma += (k.summa || 0); }
        });

        if (db.hostel_structure) {
          Object.values(db.hostel_structure).forEach(v => {
            Object.values(v || {}).forEach(f => {
              Object.values(f || {}).forEach(x => {
                Object.values(x || {}).forEach(y => { if (y?.isFree) boshYotoqlar++; });
              });
            });
          });
        }

        const statText = `📊 <b>HOSTEL REAL-VAQT STATISTIKASI</b>\n\n` +
          `👥 Aktiv Kvartirantlar: <b>${aktivlar} ta</b>\n` +
          `👨 Erkaklar: <b>${erkaklar}</b> | 👩 Ayollar: <b>${ayollar}</b>\n\n` +
          `🏢 Bo'sh joylar: <b>${boshYotoqlar} ta</b>\n` +
          `📝 Qarzdorlar: <b>${qarzdorlar} kishi</b>\n` +
          `💰 Umumiy qarzlar: <b>${formatMoney(qarzSumma)}</b>`;
        
        await clearAndSend(chatId, statText, adminMainKeyboard);
      }
      else if (text === "📜 Qoida sozlash") {
        pushState(chatId, 'ADMIN_SET_RULES');
        await clearAndSend(chatId, `Joriy qoidalar:\n<pre>${db.settings.hostel_rules}</pre>\n\nYangi qoidalarni kiriting:`, backKeyboard);
      }
      else if (text === "🏨 HOSTEL tanishuv sozlamalari") {
        pushState(chatId, 'ADMIN_SET_INFO');
        await clearAndSend(chatId, `Joriy tanishtiruv:\n<pre>${db.settings.hostel_info}</pre>\n\nYangi matn kiriting:`, backKeyboard);
      }
      else if (text === "💳 Karta Sozlamalari") {
        pushState(chatId, 'ADMIN_SET_CARD_NUM');
        await clearAndSend(chatId, `Joriy Karta: <code>${db.settings.card_number}</code>\n\nYangi karta raqamini kiriting:`, backKeyboard);
      }
      else if (text === "⛅ KUNLIK Toʻlovni sozlash") {
        pushState(chatId, 'ADMIN_SET_DAILY');
        await clearAndSend(chatId, `Joriy narx: <b>${formatMoney(db.settings.daily_price)}</b>\nYangi universal kunlik narx:`, backKeyboard);
      }
      else if (text === "📢 Xabarnoma") {
        pushState(chatId, 'ADMIN_BROADCAST');
        await clearAndSend(chatId, "Barcha foydalanuvchilarga yuboriladigan e'lon matni:", backKeyboard);
      }
      else if (text === "👮‍♂️ Admin qoʻshish") {
        pushState(chatId, 'ADMIN_ADD_CHOICE');
        let kbd = { keyboard: db.admins.map(id => [{ text: `Admin ID: ${id}` }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "➕ Yangi Admin Qo'shish" }], [{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "Admin paneli. Tanlang yoki yangi qo'shing:", kbd);
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
        await clearAndSend(chatId, "🏨 <b>HOSTEL Struktura Matrixi:</b>", kbd);
      }
      return;
    }

    if (state === 'ADMIN_SET_RULES') {
      db.settings.hostel_rules = text; saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "✅ Tizim qoidalari yangilandi!", adminMainKeyboard);
    }
    else if (state === 'ADMIN_SET_INFO') {
      db.settings.hostel_info = text; saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "✅ Tanishuv ma'lumotlari yangilandi!", adminMainKeyboard);
    }
    else if (state === 'ADMIN_SET_DAILY') {
      const price = parseMoney(text);
      if (price > 0) {
        db.settings.daily_price = price; saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, `✅ Kunlik narx ${formatMoney(price)} etib belgilandi.`, adminMainKeyboard);
      } else {
        await bot.sendMessage(chatId, "⚠️ Xato summa, qayta kiriting:");
      }
    }
    else if (state === 'ADMIN_SET_CARD_NUM') {
      db.settings.card_number = text; saveDB();
      pushState(chatId, 'ADMIN_SET_CARD_OWNER');
      await clearAndSend(chatId, "Karta egasining ismini kiriting:", backKeyboard);
    }
    else if (state === 'ADMIN_SET_CARD_OWNER') {
      db.settings.card_owner = text; saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "✅ Karta ma'lumotlari saqlandi!", adminMainKeyboard);
    }
    else if (state === 'ADMIN_BROADCAST') {
      let count = 0;
      Object.keys(sessions).forEach(uId => {
        if (parseInt(uId, 10) !== chatId) {
          bot.sendMessage(uId, `📢 <b>MA'MURIYAT E'LONI:</b>\n\n${text}`, { parse_mode: 'HTML' }).catch(() => {});
          count++;
        }
      });
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `✅ E'lon ${count} ta foydalanuvchiga uzatildi.`, adminMainKeyboard);
    }
    else if (state === 'ADMIN_ADD_CHOICE') {
      if (text === "➕ Yangi Admin Qo'shish") {
        pushState(chatId, 'ADMIN_INPUT_NEW_ID');
        await clearAndSend(chatId, "Yangi admin Telegram Chat ID raqamini yozing:", backKeyboard);
      } else {
        const idMatch = text.match(/Admin ID: (\d+)/);
        if (idMatch) {
          const selectedAdminId = parseInt(idMatch[1], 10);
          sessions[chatId].selectedAdminId = selectedAdminId;
          pushState(chatId, 'ADMIN_MANAGE_ROLE');
          const isSuper = db.superAdmins.includes(selectedAdminId);
          const roleKbd = {
            keyboard: [[isSuper ? { text: "🙅‍♂️ Bosh adminlikni olish" } : { text: "👑 Bosh admin lavozimini berish" }], [{ text: "🗑 Adminni o'chirish" }], [{ text: "⬅️ Ortga qaytish" }]],
            resize_keyboard: true
          };
          await clearAndSend(chatId, `Admin ID: ${selectedAdminId}\nLavozim: ${isSuper ? 'Super Admin' : 'Oddiy Admin'}`, roleKbd);
        }
      }
    }
    else if (state === 'ADMIN_INPUT_NEW_ID') {
      const newAdminId = parseInt(text, 10);
      if (newAdminId) {
        if (!db.admins.includes(newAdminId)) db.admins.push(newAdminId);
        saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, `✅ Admin ID ${newAdminId} muvaffaqiyatli qo'shildi.`, adminMainKeyboard);
      } else {
        await bot.sendMessage(chatId, "Faqat raqam kiriting:");
      }
    }
    else if (state === 'ADMIN_MANAGE_ROLE') {
      const selId = sessions[chatId].selectedAdminId;
      if (text === "👑 Bosh admin lavozimini berish") {
        if (!db.superAdmins.includes(selId)) db.superAdmins.push(selId);
        saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, "✅ Super Admin etib tayinlandi!", adminMainKeyboard);
      } else if (text === "🙅‍♂️ Bosh adminlikni olish") {
        if (selId === MAIN_SUPER_ADMIN) return bot.sendMessage(chatId, "Asosiy yaratuvchini o'chirib bo'lmaydi!");
        db.superAdmins = db.superAdmins.filter(id => id !== selId);
        saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, "✅ Super adminlik huquqi olindi.", adminMainKeyboard);
      } else if (text === "🗑 Adminni o'chirish") {
        if (selId === MAIN_SUPER_ADMIN) return bot.sendMessage(chatId, "Taqiqlangan amal!");
        db.admins = db.admins.filter(id => id !== selId);
        db.superAdmins = db.superAdmins.filter(id => id !== selId);
        saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, "✅ Admin olib tashlandi.", adminMainKeyboard);
      }
                                                               }
          // ARXITEKTURA METODLARI (STRUCT)
    else if (state === 'ADMIN_HOSTEL_STRUCT') {
      if (text === "➕ Viloyat qo'shish") {
        pushState(chatId, 'STRUCT_ADD_VILOYAT');
        await clearAndSend(chatId, "Yangi viloyat nomini yozing:", backKeyboard);
      } 
      else if (text === "🗑 Viloyatni o'chirish") {
        const keys = Object.keys(db.hostel_structure || {});
        if (keys.length === 0) return bot.sendMessage(chatId, "Viloyat yo'q!");
        pushState(chatId, 'STRUCT_DEL_VILOYAT');
        const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
        kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
        await clearAndSend(chatId, "O'chiriladigan viloyat:", kbd);
      } 
      else if (text === "➕ Filial qo'shish") {
        const keys = Object.keys(db.hostel_structure || {});
        pushState(chatId, 'STRUCT_ADD_FILIAL_VIL');
        const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
        await clearAndSend(chatId, "Qaysi viloyatga filial qo'shiladi?", kbd);
      } 
      else if (text === "🗑 Filialni o'chirish") {
        const keys = Object.keys(db.hostel_structure || {});
        pushState(chatId, 'STRUCT_DEL_FILIAL_VIL');
        const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
        await clearAndSend(chatId, "Viloyatni tanlang:", kbd);
      } 
      else if (text === "➕ Xona qo'shish") {
        const keys = Object.keys(db.hostel_structure || {});
        pushState(chatId, 'STRUCT_ADD_XONA_VIL');
        const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
        await clearAndSend(chatId, "Viloyatni tanlang:", kbd);
      } 
      else if (text === "🗑 Xonani o'chirish") {
        const keys = Object.keys(db.hostel_structure || {});
        pushState(chatId, 'STRUCT_DEL_XONA_VIL');
        const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
        await clearAndSend(chatId, "Viloyatni tanlang:", kbd);
      } 
      else if (text === "➕ Yotoq qo'shish") {
        const keys = Object.keys(db.hostel_structure || {});
        pushState(chatId, 'STRUCT_ADD_YOTOQ_VIL');
        const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
        await clearAndSend(chatId, "Viloyatni tanlang:", kbd);
      } 
      else if (text === "🗑 Yotoqni o'chirish") {
        const keys = Object.keys(db.hostel_structure || {});
        pushState(chatId, 'STRUCT_DEL_YOTOQ_VIL');
        const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
        await clearAndSend(chatId, "Viloyatni tanlang:", kbd);
      }
      return;
    }
    
    if (state === 'STRUCT_ADD_VILOYAT') {
      const regionName = text.trim();
      if (regionName.length < 3 || regionName.startsWith('/')) return bot.sendMessage(chatId, "⚠️ Noto'g'ri nom! Qayta kiriting:");
      sessions[chatId].tempRegionName = regionName;
      sessions[chatId].state = 'STRUCT_CONFIRM_VILOYAT'; saveSessions();

      const inlineKeyboard = { inline_keyboard: [[{ text: "✅ Tasdiqlash", callback_data: "confirm_viloyat_yes" }, { text: "❌ Bekor qilish", callback_data: "confirm_viloyat_no" }]] };
      await bot.sendMessage(chatId, `Yangi viloyat qo'shilsinmi: <b>${regionName}</b>`, { reply_markup: inlineKeyboard, parse_mode: 'HTML' });
      return;
    }
    else if (state === 'STRUCT_DEL_VILOYAT') {
      if (db.hostel_structure?.[text]) { delete db.hostel_structure[text]; saveDB(); }
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `🗑 Viloyat o'chirildi.`, adminMainKeyboard);
    }
    else if (state === 'STRUCT_ADD_FILIAL_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_ADD_FILIAL_NAME');
      await clearAndSend(chatId, `"${text}" uchun Filial nomini kiriting:`, backKeyboard);
    }
    else if (state === 'STRUCT_ADD_FILIAL_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      const filialName = text.trim();
      if (db.hostel_structure[vil]) {
        if (!db.hostel_structure[vil][filialName]) db.hostel_structure[vil][filialName] = {};
        saveDB();
      }
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `✅ Filial "${filialName}" yaratildi.`, adminMainKeyboard);
    }
    else if (state === 'STRUCT_DEL_FILIAL_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_DEL_FILIAL_NAME');
      const filials = Object.keys(db.hostel_structure[text] || {});
      const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
      await clearAndSend(chatId, "O'chiriladigan filial:", kbd);
    }
    else if (state === 'STRUCT_DEL_FILIAL_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      if (db.hostel_structure?.[vil]?.[text]) { delete db.hostel_structure[vil][text]; saveDB(); }
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `🗑 Filial tizimdan tozalandi.`, adminMainKeyboard);
    }
    else if (state === 'STRUCT_ADD_XONA_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_ADD_XONA_FIL');
      const filials = Object.keys(db.hostel_structure[text] || {});
      const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
      await clearAndSend(chatId, "Filialni tanlang:", kbd);
    }
    else if (state === 'STRUCT_ADD_XONA_FIL') {
      sessions[chatId].tempStruct.filial = text;
      pushState(chatId, 'STRUCT_ADD_XONA_NAME');
      await clearAndSend(chatId, "Xona raqami yoki nomini kiriting:", backKeyboard);
    }
    else if (state === 'STRUCT_ADD_XONA_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      const fil = sessions[chatId].tempStruct.filial;
      const roomName = text.trim();
      if (db.hostel_structure?.[vil]?.[fil]) {
        if (!db.hostel_structure[vil][fil][roomName]) db.hostel_structure[vil][fil][roomName] = {};
        saveDB();
      }
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `✅ Xona "${roomName}" qo'shildi.`, adminMainKeyboard);
    }
    else if (state === 'STRUCT_DEL_XONA_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_DEL_XONA_FIL');
      const filials = Object.keys(db.hostel_structure[text] || {});
      const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
      await clearAndSend(chatId, "Filialni tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_XONA_FIL') {
      const vil = sessions[chatId].tempStruct.viloyat;
      sessions[chatId].tempStruct.filial = text;
      pushState(chatId, 'STRUCT_DEL_XONA_NAME');
      const xonalar = Object.keys(db.hostel_structure[vil][text] || {});
      const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true };
      await clearAndSend(chatId, "O'chiriladigan xonani tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_XONA_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      const fil = sessions[chatId].tempStruct.filial;
      if (db.hostel_structure?.[vil]?.[fil]) { delete db.hostel_structure[vil][fil][text]; saveDB(); }
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, `🗑 Xona o'chirildi.`, adminMainKeyboard);
    }
    else if (state === 'STRUCT_ADD_YOTOQ_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_ADD_YOTOQ_FIL');
      const filials = Object.keys(db.hostel_structure[text] || {});
      const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
      await clearAndSend(chatId, "Filialni tanlang:", kbd);
    }
    else if (state === 'STRUCT_ADD_YOTOQ_FIL') {
      const vil = sessions[chatId].tempStruct.viloyat;
      sessions[chatId].tempStruct.filial = text;
      pushState(chatId, 'STRUCT_ADD_YOTOQ_XON');
      const xonalar = Object.keys(db.hostel_structure[vil][text] || {});
      const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true };
      await clearAndSend(chatId, "Xonani tanlang:", kbd);
    }
    else if (state === 'STRUCT_ADD_YOTOQ_XON') {
      sessions[chatId].tempStruct.xona = text;
      pushState(chatId, 'STRUCT_ADD_YOTOQ_NAME');
      await clearAndSend(chatId, "Yotoq joy nomini yozing (Masalan: 1-A):", backKeyboard);
    }
    else if (state === 'STRUCT_ADD_YOTOQ_NAME') {
      sessions[chatId].tempStruct.yotoqName = text.trim();
      pushState(chatId, 'STRUCT_ADD_YOTOQ_PRICE');
      await clearAndSend(chatId, "Ushbu yotoq uchun OYLIK narxni kiriting:", backKeyboard);
    }
    else if (state === 'STRUCT_ADD_YOTOQ_PRICE') {
      const priceNum = parseMoney(text);
      if (priceNum > 0) {
        const vil = sessions[chatId].tempStruct.viloyat;
        const fil = sessions[chatId].tempStruct.filial;
        const xon = sessions[chatId].tempStruct.xona;
        const yot = sessions[chatId].tempStruct.yotoqName;

        if (!db.hostel_structure[vil]) db.hostel_structure[vil] = {};
        if (!db.hostel_structure[vil][fil]) db.hostel_structure[vil][fil] = {};
        if (!db.hostel_structure[vil][fil][xon]) db.hostel_structure[vil][fil][xon] = {};

        db.hostel_structure[vil][fil][xon][yot] = { price: priceNum, isFree: true };
        saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
        await clearAndSend(chatId, `✅ Joy qo'shildi!\nNarxi: <b>${formatMoney(priceNum)}</b>`, adminMainKeyboard);
      } else {
        await bot.sendMessage(chatId, "⚠️ Narx xato, qayta urinib ko'ring:");
      }
    }
    else if (state === 'STRUCT_DEL_YOTOQ_VIL') {
      sessions[chatId].tempStruct = { viloyat: text };
      pushState(chatId, 'STRUCT_DEL_YOTOQ_FIL');
      const filials = Object.keys(db.hostel_structure[text] || {});
      const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
      await clearAndSend(chatId, "Filialni tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_YOTOQ_FIL') {
      const vil = sessions[chatId].tempStruct.viloyat;
      sessions[chatId].tempStruct.filial = text;
      pushState(chatId, 'STRUCT_DEL_YOTOQ_XON');
      const xonalar = Object.keys(db.hostel_structure[vil][text] || {});
      const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true };
      await clearAndSend(chatId, "Xonani tanlang:", kbd);
    }
    else if (state === 'STRUCT_DEL_YOTOQ_XON') {
      const vil = sessions[chatId].tempStruct.viloyat;
      const fil = sessions[chatId].tempStruct.filial;
      sessions[chatId].tempStruct.xona = text;
      pushState(chatId, 'STRUCT_DEL_YOTOQ_NAME');
      const yotoqlar = Object.keys(db.hostel_structure[vil][fil][text] || {});
      const kbd = { keyboard: yotoqlar.map(y => [{ text: y }]), resize_keyboard: true };
      await clearAndSend(chatId, "O'chiriladigan yotoq:", kbd);
    }
    else if (state === 'STRUCT_DEL_YOTOQ_NAME') {
      const vil = sessions[chatId].tempStruct.viloyat;
      const fil = sessions[chatId].tempStruct.filial;
      const xon = sessions[chatId].tempStruct.xona;
      if (db.hostel_structure?.[vil]?.[fil]?.[xon]) { delete db.hostel_structure[vil][fil][xon][text]; saveDB(); }
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "🗑 Yotoq o'chirildi.", adminMainKeyboard);
    }
    return;
          }

         // ESLAТMA (COMMENT INPUT)
  if (state.startsWith('COMMENT_INPUT_')) {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    const targetUserId = state.split('_')[2];
    if (db.kvartirantlar[targetUserId]) {
      db.kvartirantlar[targetUserId].eslatma = text; saveDB();
      const targetGroup = db.kvartirantlar[targetUserId].status === 'aktiv' ? db.settings.Aktiv_Guruh : db.settings.Qarz_Guruh;
      const msgIdInGroup = db.kvartirantlar[targetUserId].groupMsgId;
      
      if (targetGroup && msgIdInGroup) {
        const buildText = generateAnketaText(targetUserId);
        const buildMarkup = generateAnketaInlineMarkup(targetUserId, db.kvartirantlar[targetUserId].status === 'aktiv' ? "group_active" : "group_active");
        try { await bot.editMessageCaption(buildText, { chat_id: targetGroup, message_id: msgIdInGroup, reply_markup: buildMarkup, parse_mode: 'HTML' }); } catch(e){}
      }
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(chatId, "📌 Eslatma saqlandi va guruhda yangilandi!", adminMainKeyboard);
    }
  }
});

// ------------------- RASYAM VA MULTIMEDIA -------------------
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) return;
  const state = sessions[chatId].state;
  const photoId = msg.photo[msg.photo.length - 1].file_id;

  if (state === 'REG_SELFIE') {
    sessions[chatId].regData.selfiePhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    pushState(chatId, 'REG_GENDER');
    await clearAndSend(chatId, "7. Jinsingizni belgilang:", genderKeyboard);
  }
  else if (state === 'REG_SEND_CHEK') {
    sessions[chatId].regData.chekPhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    await sendRequestToAdmins(chatId, true);
    sessions[chatId].state = 'MAIN_MENU'; saveSessions();
    await clearAndSend(chatId, "Chek qabul qilindi. Tasdiqlangach bot faollashadi.", mainKeyboard);
  }
  else if (state === 'KVAR_SEND_CHEK') {
    sessions[chatId].renewData.chekPhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    await sendRenewRequestToAdmins(chatId, true);
    sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
    await clearAndSend(chatId, "Skrinshot adminga yetkazildi.", kvartirantKeyboard);
  }
  else if (state === 'KVAR_SEND_MUROJAAT') {
    const captionText = msg.caption || "Matnsiz rasm.";
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    await sendMurojaatToAdmins(chatId, photoId, captionText);
    sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
    await clearAndSend(chatId, "Murojaatingiz barcha adminlarga yuborildi!", kvartirantKeyboard);
  }
});

// ------------------- ANKETA GENERATORLARI -------------------
function generateAnketaText(userId, isNewPayment = false, renewData = null) {
  const data = db.kvartirantlar[userId] || sessions[userId]?.regData || renewData;
  if (!data) return "Ma'lumot topilmadi.";

  let statusTitle = "🔔 YANGI ARIZA / TOʻLOV";
  if (data.status === 'aktiv') statusTitle = "✅ AKTIV KVARTIRANT";
  if (data.status === 'qarz') statusTitle = "⚠️ QARZDOR KVARTIRANT";
  if (data.status === 'arxiv') statusTitle = "⛔️ KETGAN KVARTIRANT (ARXIV)";

  const payType = renewData ? renewData.payType : (data.payType || "Aniqlanmagan");
  const summa = renewData ? renewData.summa : (data.summa || 0);
  const eslatma = data.eslatma || "Mavjud emas";

  let txt = `<b>${statusTitle}</b>\n\n`;
  if (!data.status || isNewPayment) {
    txt += `💵 Toʻlov uslubi: <b>${payType}</b>\n🤝 Summa: <b>${formatMoney(summa)}</b>\n`;
  }
  txt += `\n👤 F.I.SH: <b>${data.fish || "Noma'lum"}</b>
📅 Tugʻilgan sana: <b>${data.birth || "-"}</b>
🪪 Pasport: <b>${data.passport || "-"}</b>
🆔 JSHSHIR: <b>${data.jshshir || "-"}</b>
📞 Telefon: <b>${data.phone || "-"}</b>
🚩 Viloyat: <b>${data.viloyat || "-"}</b>
🏨 Filial: <b>${data.filial || "-"}</b>
🚪 Xona: <b>${data.xona || "-"}</b>
🛏 Yotoq joyi: <b>${data.yotoq || "-"}</b>
📅 Ijara muddati: <b>${data.muddati || "-"}</b>
📌 Eslatma: <b>${eslatma}</b>`;

  return txt;
}

function generateAnketaInlineMarkup(userId, mode = "admin_verify") {
  if (mode === "admin_verify") {
    return {
      inline_keyboard: [
        [{ text: "👤 Profilga O'tish", url: `tg://user?id=${userId}` }],
        [{ text: "✅ Tasdiqlash", callback_data: `verify_yes_${userId}` }, { text: "❌ Rad etish", callback_data: `verify_no_${userId}` }]
      ]
    };
  } else if (mode === "group_active") {
    return {
      inline_keyboard: [
        [{ text: "👤 Profili", url: `tg://user?id=${userId}` }],
        [{ text: "📌 Eslatma yozish", callback_data: `group_note_${userId}` }, { text: "❌ Chiqib ketdi", callback_data: `group_exit_${userId}` }]
      ]
    };
  } else if (mode === "group_archive") {
    return {
      inline_keyboard: [
        [{ text: "👤 Profili", url: `tg://user?id=${userId}` }],
        [{ text: "📌 Eslatma", callback_data: `group_note_${userId}` }, { text: "✅ Qayta AKTIV qilish", callback_data: `verify_yes_${userId}` }]
      ]
    };
  }
}

async function sendRequestToAdmins(userId, hasChek = false) {
  const regData = sessions[userId].regData;
  const txt = generateAnketaText(userId);
  const markup = generateAnketaInlineMarkup(userId, "admin_verify");
  sessions[userId].adminMsgMap = {}; 

  for (let admId of db.admins) {
    try {
      let sentMsg;
      if (hasChek && regData.chekPhoto) {
        sentMsg = await bot.sendPhoto(admId, regData.chekPhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' });
      } else if (regData.selfiePhoto) {
        sentMsg = await bot.sendPhoto(admId, regData.selfiePhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' });
      } else {
        sentMsg = await bot.sendMessage(admId, txt, { reply_markup: markup, parse_mode: 'HTML' });
      }
      sessions[userId].adminMsgMap[admId] = sentMsg.message_id;
    } catch (e) {}
  }
  saveSessions();
}

async function sendRenewRequestToAdmins(userId, hasChek = false) {
  const renewData = sessions[userId].renewData;
  const kv = db.kvartirantlar[userId];
  const txt = generateAnketaText(userId, true, renewData);
  const markup = { inline_keyboard: [[{ text: "👤 Profili", url: `tg://user?id=${userId}` }], [{ text: "✅ Tasdiqlash", callback_data: `renew_yes_${userId}` }, { text: "❌ Rad etish", callback_data: `renew_no_${userId}` }]] };
  sessions[userId].renewMsgMap = {};

  for (let admId of db.admins) {
    try {
      let sentMsg;
      if (hasChek && renewData.chekPhoto) {
        sentMsg = await bot.sendPhoto(admId, renewData.chekPhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' });
      } else if (kv?.selfiePhoto) {
        sentMsg = await bot.sendPhoto(admId, kv.selfiePhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' });
      } else {
        sentMsg = await bot.sendMessage(admId, txt, { reply_markup: markup, parse_mode: 'HTML' });
      }
      sessions[userId].renewMsgMap[admId] = sentMsg.message_id;
    } catch(e){}
  }
  saveSessions();
}

async function sendMurojaatToAdmins(userId, photoId = null, textMsg = "") {
  const kv = db.kvartirantlar[userId];
  if (!kv) return;
  const murojaatTxt = `🔔 <b>YANGI MUROJAATNOMA</b>\n\n👤 F.I.SH: <b>${kv.fish}</b>\n🚪 Xona: <b>${kv.xona}</b>, Yotoq: <b>${kv.yotoq}</b>\n\n📨 <b>Matni:</b> ${textMsg}`;
  const markup = { inline_keyboard: [[{ text: "✅ O'qildi (Yopish)", callback_data: `murojaat_ok` }]] };

  for (let admId of db.admins) {
    try {
      if (photoId) await bot.sendPhoto(admId, photoId, { caption: murojaatTxt, reply_markup: markup, parse_mode: 'HTML' });
      else if (kv.selfiePhoto) await bot.sendPhoto(admId, kv.selfiePhoto, { caption: murojaatTxt, reply_markup: markup, parse_mode: 'HTML' });
      else await bot.sendMessage(admId, murojaatTxt, { reply_markup: markup, parse_mode: 'HTML' });
    } catch(e){}
  }
                                                       }

// ------------------- CALLBACK ISHLOVCHI -------------------
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;

  if (data === 'confirm_viloyat_yes') {
    const regionName = sessions[chatId]?.tempRegionName;
    if (regionName) {
      if (!db.hostel_structure) db.hostel_structure = {};
      db.hostel_structure[regionName] = {}; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; delete sessions[chatId].tempRegionName; saveSessions();
      try { await bot.deleteMessage(chatId, query.message.message_id); } catch(e){}
      await clearAndSend(chatId, `✅ "${regionName}" muvaffaqiyatli qo'shildi!`, adminMainKeyboard);
    }
    return;
  }

  if (data === 'confirm_viloyat_no') {
    sessions[chatId].state = 'ADMIN_MAIN'; delete sessions[chatId].tempRegionName; saveSessions();
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch(e){}
    await clearAndSend(chatId, "❌ Bekor qilindi.", adminMainKeyboard);
    return;
  }
                                    
  if (data.startsWith('verify_yes_')) {
    const targetUserId = data.split('_')[2];
    let regData = sessions[targetUserId]?.regData || db.kvartirantlar[targetUserId];
    
    if (regData) {
      if (sessions[targetUserId]?.adminMsgMap) {
        for (let admId of Object.keys(sessions[targetUserId].adminMsgMap)) {
          try { await bot.deleteMessage(admId, sessions[targetUserId].adminMsgMap[admId]); } catch(e){}
        }
      }

      db.kvartirantlar[targetUserId] = {
        ...regData,
        status: 'aktiv',
        eslatma: regData.eslatma || "Kiritilmagan",
        joinDate: new Date()
      };
      
      try { if (db.hostel_structure[regData.viloyat][regData.filial][regData.xona][regData.yotoq]) db.hostel_structure[regData.viloyat][regData.filial][regData.xona][regData.yotoq].isFree = false; } catch(e){}
      saveDB();

      bot.sendMessage(targetUserId, "🎉 Arizangiz ma'muriyat tomonidan tasdiqlandi. /start buyrug'ini bosing.");

      if (db.settings.Aktiv_Guruh) {
        const groupText = generateAnketaText(targetUserId);
        const groupMarkup = generateAnketaInlineMarkup(targetUserId, "group_active");
        try {
          let sMsg = regData.selfiePhoto ? await bot.sendPhoto(db.settings.Aktiv_Guruh, regData.selfiePhoto, { caption: groupText, reply_markup: groupMarkup, parse_mode: 'HTML' })
                                         : await bot.sendMessage(db.settings.Aktiv_Guruh, groupText, { reply_markup: groupMarkup, parse_mode: 'HTML' });
          db.kvartirantlar[targetUserId].groupMsgId = sMsg.message_id; saveDB();
        } catch (e) {}
      }
      await bot.answerCallbackQuery(query.id, { text: "Kvartirant faollashtirildi!" });
    }
  }

  else if (data.startsWith('verify_no_')) {
    const targetUserId = data.split('_')[2];
    if (sessions[targetUserId]?.adminMsgMap) {
      for (let admId of Object.keys(sessions[targetUserId].adminMsgMap)) {
        try { await bot.deleteMessage(admId, sessions[targetUserId].adminMsgMap[admId]); } catch(e){}
      }
    }
    bot.sendMessage(targetUserId, "❌ Kechirasiz, arizangiz yoki to'lov cheki rad etildi.");
    await bot.answerCallbackQuery(query.id, { text: "Rad etildi." });
  }

  else if (data.startsWith('renew_yes_')) {
    const targetUserId = data.split('_')[2];
    const renewData = sessions[targetUserId]?.renewData;
    if (renewData && db.kvartirantlar[targetUserId]) {
      if (sessions[targetUserId].renewMsgMap) {
        for (let admId of Object.keys(sessions[targetUserId].renewMsgMap)) {
          try { await bot.deleteMessage(admId, sessions[targetUserId].renewMsgMap[admId]); } catch(e){}
        }
      }

      const oldStatus = db.kvartirantlar[targetUserId].status;
      db.kvartirantlar[targetUserId].muddati = renewData.muddati;
      db.kvartirantlar[targetUserId].status = 'aktiv'; saveDB();

      bot.sendMessage(targetUserId, `✅ Ijara muddatingiz ${renewData.muddati}gacha uzaytirildi.`);

      if (oldStatus === 'qarz' && db.settings.Qarz_Guruh && db.kvartirantlar[targetUserId].groupMsgId) {
        try { await bot.deleteMessage(db.settings.Qarz_Guruh, db.kvartirantlar[targetUserId].groupMsgId); } catch(e){}
        if (db.settings.Aktiv_Guruh) {
          const groupText = generateAnketaText(targetUserId);
          const groupMarkup = generateAnketaInlineMarkup(targetUserId, "group_active");
          try {
            let sMsg = await bot.sendPhoto(db.settings.Aktiv_Guruh, db.kvartirantlar[targetUserId].selfiePhoto, { caption: groupText, reply_markup: groupMarkup, parse_mode: 'HTML' });
            db.kvartirantlar[targetUserId].groupMsgId = sMsg.message_id; saveDB();
          } catch(e){}
        }
      } else if (db.settings.Aktiv_Guruh && db.kvartirantlar[targetUserId].groupMsgId) {
        const buildText = generateAnketaText(targetUserId);
        try { await bot.editMessageCaption(buildText, { chat_id: db.settings.Aktiv_Guruh, message_id: db.kvartirantlar[targetUserId].groupMsgId, reply_markup: generateAnketaInlineMarkup(targetUserId, "group_active"), parse_mode: 'HTML' }); } catch(e){}
      }
      await bot.answerCallbackQuery(query.id, { text: "Muddati uzaytirildi!" });
    }
  }

  else if (data.startsWith('group_note_')) {
    const targetUserId = data.split('_')[2];
    const clickerAdminId = query.from.id;
    sessions[clickerAdminId] = { state: `COMMENT_INPUT_${targetUserId}`, history: [], lastMessageIds: [] }; saveSessions();
    try {
      await bot.sendMessage(clickerAdminId, "📌 Ushbu kvartirant uchun maxsus eslatma yozib qoldiring:");
      await bot.answerCallbackQuery(query.id, { text: "Shaxsiy chatingizga so'rov yuborildi." });
    } catch (e) {
      await bot.answerCallbackQuery(query.id, { text: "Xato: Avval botga shaxsiy xabar yuboring!" });
    }
  }

  else if (data.startsWith('group_exit_')) {
    const targetUserId = data.split('_')[2];
    const kv = db.kvartirantlar[targetUserId];
    if (kv) {
      const oldGroup = kv.status === 'aktiv' ? db.settings.Aktiv_Guruh : db.settings.Qarz_Guruh;
      if (oldGroup && kv.groupMsgId) { try { await bot.deleteMessage(oldGroup, kv.groupMsgId); } catch(e){} }

      try { if (db.hostel_structure[kv.viloyat][kv.filial][kv.xona][kv.yotoq]) db.hostel_structure[kv.viloyat][kv.filial][kv.xona][kv.yotoq].isFree = true; } catch(e){}
      kv.status = 'arxiv'; saveDB();

      if (db.settings.Ketgan_Guruh) {
        const arcText = generateAnketaText(targetUserId);
        try {
          const sentArcMsg = await bot.sendPhoto(db.settings.Ketgan_Guruh, kv.selfiePhoto, { caption: arcText, reply_markup: generateAnketaInlineMarkup(targetUserId, "group_archive"), parse_mode: 'HTML' });
          db.kvartirantlar[targetUserId].groupMsgId = sentArcMsg.message_id; saveDB();
        } catch(e){}
      }
      await bot.answerCallbackQuery(query.id, { text: "Kvartirant arxivlandi." });
    }
  }

  else if (data === 'murojaat_ok') {
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch(e){}
    await bot.answerCallbackQuery(query.id, { text: "Murojaat yopildi." });
  }
});

// ------------------- NAVIGATSIYA QAYTISH TIZIMI -------------------
async function handleStateReturn(chatId, prevState) {
  if (prevState === 'MAIN_MENU') {
    if (db.kvartirantlar[chatId] && (db.kvartirantlar[chatId].status === 'aktiv' || db.kvartirantlar[chatId].status === 'qarz')) {
      return await clearAndSend(chatId, "Asosiy profil paneli:", kvartirantKeyboard);
    }
    await clearAndSend(chatId, "Asosiy menyu:", mainKeyboard);
  } else if (prevState === 'ADMIN_MAIN') {
    await clearAndSend(chatId, "👑 Admin panel bosh menyusi:", adminMainKeyboard);
  } else if (prevState === 'ADMIN_HOSTEL_STRUCT') {
    const kbd = {
      keyboard: [[{ text: "➕ Viloyat qo'shish" }, { text: "🗑 Viloyatni o'chirish" }], [{ text: "➕ Filial qo'shish" }, { text: "🗑 Filialni o'chirish" }], [{ text: "➕ Xona qo'shish" }, { text: "🗑 Xonani o'chirish" }], [{ text: "➕ Yotoq qo'shish" }, { text: "🗑 Yotoqni o'chirish" }], [{ text: "⬅️ Ortga qaytish" }]],
      resize_keyboard: true
    };
    await clearAndSend(chatId, "Struktura sozlamalari:", kbd);
  } else if (prevState === 'KVARTIRANT_MENU') {
    await clearAndSend(chatId, "Profilingiz paneli:", kvartirantKeyboard);
  }
}

// ------------------- AVTOMATIK CRON JADVALI (3 MAHAL) -------------------
cron.schedule('0 9,14,20 * * *', async () => {
  console.log("⏰ Muddatlar va qarzdorliklar tekshirilmoqda...");
  const now = new Date();

  for (let uId of Object.keys(db.kvartirantlar || {})) {
    const kv = db.kvartirantlar[uId];
    if (!kv || (kv.status !== 'aktiv' && kv.status !== 'qarz')) continue;

    const parts = kv.muddati.split('.');
    if (parts.length !== 3) continue;
    const expiryDate = new Date(parts[2], parts[1] - 1, parts[0]);

    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3 && diffDays > 0) {
      const warnMsg = `⚠️ <b>DIQQAT OGOHLANTIRISH!</b>\nHurmatli kvartirant, ijara muddatingiz tugashiga <b>${diffDays} kun</b> qoldi. To'lov qiling!`;
      await bot.sendMessage(uId, warnMsg, { parse_mode: 'HTML' }).catch(() => {});
    } 
    else if (diffDays <= 0 && kv.status === 'aktiv') {
      if (db.settings.Aktiv_Guruh && kv.groupMsgId) { try { await bot.deleteMessage(db.settings.Aktiv_Guruh, kv.groupMsgId); } catch(e){} }

      kv.status = 'qarz'; saveDB();
      await bot.sendMessage(uId, "⚠️ Ijara muddatingiz yakunlandi va siz QARZDORLAR ro'yxatiga kiritildingiz!").catch(() => {});

      if (db.settings.Qarz_Guruh) {
        const qarzText = generateAnketaText(uId);
        try {
          const sentQarzMsg = await bot.sendPhoto(db.settings.Qarz_Guruh, kv.selfiePhoto, { caption: qarzText, reply_markup: generateAnketaInlineMarkup(uId, "group_active"), parse_mode: 'HTML' });
          db.kvartirantlar[uId].groupMsgId = sentQarzMsg.message_id; saveDB();
        } catch(e){}
      }
    }
  }
});

console.log("🚀 Tinchlik Hostel Advanced CRM Enterprise Bot muvaffaqiyatli start oldi!");
