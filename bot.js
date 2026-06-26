/*
 * ============================================================================
 * TINCHLIK HOSTEL - ENTERPRISE AUTOMATION CRM SYSTEM
 * ============================================================================
 * Mualliflik huquqi: Enterprise Standard
 * Server platformasi: GitHub / Render (Uzluksiz faoliyat)
 * Arxitektura: State Machine Matrix & Multi-Admin Sync Engine
 * ============================================================================
 */

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// --- WEB SERVER MONITORING ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Tinchlik Hostel CRM Server Online!'));
app.listen(PORT, () => console.log(`Web Server listening on port ${PORT}`));

// --- CONFIGURATIONS ---
const TOKEN = '8949142604:AAGqrksBXzXZqOiBPIP0EWLHFJPpSX9Tlmk';
const MAIN_SUPER_ADMIN = 8485164743;
const bot = new TelegramBot(TOKEN, { polling: true });
const DB_FILE = path.join(__dirname, 'hostel_crm_db.json');

// --- DATABASE INITIATION ---
let db = {
  admins: [MAIN_SUPER_ADMIN],
  settings: {
    Aktiv_Guruh: null,
    Qarz_Guruh: null,
    Ketgan_Guruh: null,
    karta_raqam: "Xali kiritilmagan",
    karta_ega: "Kiritilmagan",
    hostel_qoidalar: "Qoidalar hali yozilmadi.",
    hostel_tanishuv: "Hostel haqida ma'lumot kiritilmadi.",
    kunlik_narx: 50000
  },
  structure: {
    regions: [],   // { id, name }
    branches: [],  // { id, region_id, name }
    rooms: [],     // { id, branch_id, room_number }
    beds: []       // { id, room_id, bed_number, price, status: 'bosh'|'band', user_id: null }
  },
  kvartirantlar: {}, // telegram_id: { fio, bdate, phone, passport, jshshir, selfie, gender, bed_id, type, days, start_date, end_date, pay_method, status, eslatma, admin_msgs: [] }
  sessions: {},       // telegram_id: { state, step, data: {}, history: [], last_bot_msg_id: null }
  pending_requests: {}, // request_id: { user_id, type, data, admin_msgs: [] }
  monthly_counter: 0
};

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      console.error("Baza yuklashda xato, tiklanmoqda...", e);
    }
  } else {
    saveDB();
  }
}
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}
loadDB();

// --- HELPERS ---
function initSession(userId) {
  if (!db.sessions[userId]) {
    db.sessions[userId] = { state: 'IDLE', step: 0, data: {}, history: [], last_bot_msg_id: null };
  }
  return db.sessions[userId];
}
function isAdmin(userId) {
  return db.admins.includes(Number(userId));
}
function isKvartirant(userId) {
  const kv = db.kvartirantlar[userId];
  return kv && (kv.status === 'aktiv' || kv.status === 'qarz');
}
function getKvartirantBranchName(userId) {
  const kv = db.kvartirantlar[userId];
  if (!kv || !kv.bed_id) return "Tinchlik";
  const bed = db.structure.beds.find(b => b.id === kv.bed_id);
  if (!bed) return "Tinchlik";
  const room = db.structure.rooms.find(r => r.id === bed.room_id);
  if (!room) return "Tinchlik";
  const br = db.structure.branches.find(b => b.id === room.branch_id);
  return br ? br.name : "Tinchlik";
}
function generateShortId(prefix) {
  return prefix + '_' + Math.random().toString(36).substr(2, 7);
}

// --- KEYBOARDS ---
const kb_start_guest = {
  reply_markup: {
    keyboard: [
      ['👤 Roʻyxatdan oʻtish'],
      ['🏨 HOSTEL bilan tanishish', '🛂 HOSTEL Qoidalar']
    ],
    resize_keyboard: true
  }
};

const kb_start_kvartirant = {
  reply_markup: {
    keyboard: [
      ['📅 Ijara Muddati', '💵 Toʻlov qilish'],
      ['💳 Karta Raqam', '📜 Qoidalar'],
      ['🛂 Adminga murojat yoʻllash']
    ],
    resize_keyboard: true
  }
};

const kb_admin_panel = {
  reply_markup: {
    keyboard: [
      ['📊 STATISTIKA', '📜 Qoida sozlash'],
      ['🏨 HOSTEL Sozlash', '👮‍♂️ Admin qoʻshish'],
      ['💳 Karta Sozlamalari', '📢 Xabarnoma'],
      ['🏨 HOSTEL tanishuv sozlamalari'],
      ['⛅ KUNLIK Toʻlovni sozlash'],
      ['⬅️ Ortga Qaytish']
    ],
    resize_keyboard: true
  }
};

const kb_gender = {
  reply_markup: {
    keyboard: [['Erkak', 'Ayol'], ['⬅️ Ortga Qaytish']],
    resize_keyboard: true
  }
};

const kb_back = {
  reply_markup: {
    keyboard: [['⬅️ Ortga Qaytish']],
    resize_keyboard: true
  }
};

// --- CHAT CLEANER ENGINE ---
async function clearAndSend(chatId, userId, text, keyboard = null, parseMode = 'HTML') {
  const session = initSession(userId);
  if (session.last_bot_msg_id) {
    try {
      await bot.deleteMessage(chatId, session.last_bot_msg_id);
    } catch (e) {}
  }
  const opts = { parse_mode: parseMode };
  if (keyboard) opts.reply_markup = keyboard.reply_markup;
  
  const sent = await bot.sendMessage(chatId, text, opts);
  session.last_bot_msg_id = sent.message_id;
  saveDB();
}

// --- AUTOMATED CRON JOB (3 TIMES DAILY: 09:00, 14:00, 20:00) ---
const cron_hours = ['0 9 * * *', '0 14 * * *', '0 20 * * *'];
cron_hours.forEach(scheduleTime => {
  cron.schedule(scheduleTime, async () => {
    const today = new Date();
    for (const uId in db.kvartirantlar) {
      const kv = db.kvartirantlar[uId];
      if (kv.status === 'arxiv') continue;
      
      const [d, m, y] = kv.end_date.split('.');
      const expDate = new Date(y, m - 1, d);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 3 && diffDays > 0) {
        const warn_msg = `⚠️ <b>DIQQAT OGOHLANTIRISH!</b>\nHurmatli kvartirant, ijara muddatingiz tugashiga <b>${diffDays} kun</b> qoldi. To'lovni amalga oshirishingizni so'raymiz!`;
        await bot.sendMessage(uId, warn_msg, { parse_mode: 'HTML' }).catch(()=>{});
        
        db.admins.forEach(admId => {
          bot.sendMessage(admId, `⚠️ Kvartirant <b>${kv.fio}</b> ijara muddati tugashiga ${diffDays} kun qoldi.`, { parse_mode: 'HTML' }).catch(()=>{});
        });
      } else if (diffDays <= 0 && kv.status === 'aktiv') {
        kv.status = 'qarz';
        saveDB();
        
        // Remove from aktiv group if configured
        if (db.settings.Aktiv_Guruh && kv.group_msg_id) {
          try { await bot.deleteMessage(db.settings.Aktiv_Guruh, kv.group_msg_id); } catch(e){}
        }
        
        const qarz_text = `⚠️ <b>QARZDOR Kvartirant</b>\n\n👤 <b>F.I.SH:</b> ${kv.fio}\n📅 <b>Tugʻilgan sanasi:</b> ${kv.bdate}\n🪪 <b>Pasport Seriyasi:</b> ${kv.passport}\n🆔 <b>JSHSHIR Raqami:</b> ${kv.jshshir}\n📞 <b>Tel Raqami:</b> ${kv.phone}\n📅 <b>Muddati tugagan:</b> ${kv.end_date}\n📌 <b>Eslatma:</b> ${kv.eslatma || 'Yo'q'}`;
        const qarz_inline = {
          inline_keyboard: [
            [{ text: "👤 Telegram Profili", url: `tg://user?id=${uId}` }],
            [{ text: "📌 Eslatma kiritish", callback_data: `eslatma_${uId}` }, { text: "❌ Kvartirant ketgan", callback_data: `ketgan_${uId}` }]
          ]
        };
        
        if (db.settings.Qarz_Guruh) {
          let s_photo = kv.selfie;
          if (s_photo) {
            const sentG = await bot.sendPhoto(db.settings.Qarz_Guruh, s_photo, { caption: qarz_text, parse_mode: 'HTML', reply_markup: qarz_inline }).catch(()=>{});
            if(sentG) kv.group_msg_id = sentG.message_id;
          } else {
            const sentG = await bot.sendMessage(db.settings.Qarz_Guruh, qarz_text, { parse_mode: 'HTML', reply_markup: qarz_inline }).catch(()=>{});
            if(sentG) kv.group_msg_id = sentG.message_id;
          }
          saveDB();
        }
        
        await bot.sendMessage(uId, "⚠️ Sizning ijara muddatingiz yakunlandi va tizim tomonidan QARZDORLAR ro'yxatiga kiritildingiz! Iltimos, zudlik bilan to'lov qiling.").catch(()=>{});
      }
    }
  });
});

// ==========================================
// ASOSIY XABARLAR HANDLERI (MESSAGE EVENT)
// ==========================================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (msg.text && (msg.text.startsWith('/') || msg.text === '⬅️ Ortga Qaytish')) {
    // Command process triggers clean rules
  } else {
    if (msg.text !== '/start' && msg.text !== '/admin') {
      try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    }
  }

  const session = initSession(userId);

  // --- COMMAND RULES ---
  if (text === '/start') {
    session.state = 'IDLE';
    session.step = 0;
    session.data = {};
    session.history = [];
    saveDB();
    
    if (isKvartirant(userId)) {
      const bName = getKvartirantBranchName(userId);
      return clearAndSend(chatId, userId, `Assalomu alaykum <b>${bName}</b> Profilingizga xush kelibsiz...I`, kb_start_kvartirant);
    } else {
      return clearAndSend(chatId, userId, "<b>Tinchlik HOSTEL</b> tizimiga xush kelibsiz! Iltimos quyidagi tugmalardan birini tanlang:", kb_start_guest);
    }
  }

  if (text === '/admin') {
    if (!isAdmin(userId)) {
      return clearAndSend(chatId, userId, "Kechirasiz hurmatli foydalanuvchi Siz Admin paneliga kirish huquqiga ega emassiz...!");
    }
    session.state = 'ADMIN_PANEL';
    session.step = 0;
    saveDB();
    return clearAndSend(chatId, userId, "👑 <b>Admin paneliga xush kelibsiz!</b>\nTizim sozlamalari va kvartirantlar nazorati boshqaruvi:", kb_admin_panel);
  }

  // --- GRUPLARNI SOZLASH BUYRUQLARI ---
  if (text === '/aktiv' && isAdmin(userId)) {
    db.settings.Aktiv_Guruh = chatId;
    saveDB();
    return bot.sendMessage(chatId, "✅ Ushbu guruh AKTIV kvartirantlar bazasi sifatida sozlandi.");
  }
  if (text === '/qarz' && isAdmin(userId)) {
    db.settings.Qarz_Guruh = chatId;
    saveDB();
    return bot.sendMessage(chatId, "⚠️ Ushbu guruh QARZDORLAR bazasi sifatida sozlandi.");
  }
  if (text === '/arxiv' && isAdmin(userId)) {
    db.settings.Ketgan_Guruh = chatId;
    saveDB();
    return bot.sendMessage(chatId, "❌ Ushbu guruh KETGAN kvartirantlar arxiviga aylantirildi.");
  }

  // --- BACK MANAGEMENT ENGINE ---
  if (text === '⬅️ Ortga Qaytish') {
    if (session.history.length > 0) {
      const prev = session.history.pop();
      session.state = prev.state;
      session.step = prev.step;
      session.data = prev.data;
      saveDB();
      return clearAndSend(chatId, userId, prev.text, prev.keyboard);
    } else {
      session.state = 'IDLE';
      saveDB();
      if (isKvartirant(userId)) return clearAndSend(chatId, userId, "Asosiy menyu:", kb_start_kvartirant);
      if (isAdmin(userId)) return clearAndSend(chatId, userId, "👑 Admin paneli:", kb_admin_panel);
      return clearAndSend(chatId, userId, "Asosiy menyu:", kb_start_guest);
    }
  }

  // --- TRACK HISTORY FUNCTION ---
  function pushHistory(txt, kb) {
    session.history.push({
      state: session.state,
      step: session.step,
      data: JSON.parse(JSON.stringify(session.data)),
      text: txt,
      keyboard: kb
    });
    saveDB();
  }

  // ==========================================
  // GUEST STATE FLOWS (REGISTRATION)
  // ==========================================
  if (text === '👤 Roʻyxatdan oʻtish' && session.state === 'IDLE') {
    pushHistory("Asosiy menyu", kb_start_guest);
    session.state = 'REG_FIO';
    saveDB();
    return clearAndSend(chatId, userId, "<b>1/7.</b> Iltimos, Familiya Ism Sharifingizni (F.I.SH) kiriting:", kb_back);
  }

  if (session.state === 'REG_FIO') {
    session.data.fio = text.trim();
    pushHistory("1/7. Familiya Ism Sharifingizni kiriting:", kb_back);
    session.state = 'REG_BDATE';
    saveDB();
    return clearAndSend(chatId, userId, "<b>2/7.</b> Tugʻilgan sanangizni kiriting\n<i>Format: Kun.Oy.Yil (Masalan: 25.10.2001)</i>:", kb_back);
  }

  if (session.state === 'REG_BDATE') {
    session.data.bdate = text.trim();
    pushHistory("2/7. Tugʻilgan sanangizni kiriting:", kb_back);
    session.state = 'REG_PHONE';
    saveDB();
    return clearAndSend(chatId, userId, "<b>3/7.</b> Telefon raqamingizni kiriting (Masalan: +998901234567):", kb_back);
  }

  if (session.state === 'REG_PHONE') {
    session.data.phone = text.trim();
    pushHistory("3/7. Telefon raqamingizni kiriting:", kb_back);
    session.state = 'REG_PASSPORT';
    saveDB();
    return clearAndSend(chatId, userId, "<b>4/7.</b> Pasport Seriyasi va Raqamini kiriting (Masalan: AD1234567):", kb_back);
  }

  if (session.state === 'REG_PASSPORT') {
    session.data.passport = text.trim().toUpperCase();
    pushHistory("4/7. Pasport Seriyasi va Raqamini kiriting:", kb_back);
    session.state = 'REG_JSHSHIR';
    saveDB();
    return clearAndSend(chatId, userId, "<b>5/7.</b> Pasportingizdagi 14 xonali JSHSHIR raqamini kiriting:", kb_back);
  }

  if (session.state === 'REG_JSHSHIR') {
    session.data.jshshir = text.trim();
    pushHistory("5/7. Pasportingizdagi JSHSHIR raqamini kiriting:", kb_back);
    session.state = 'REG_SELFIE';
    saveDB();
    return clearAndSend(chatId, userId, "<b>6/7.</b> Iltimos, yuzingiz aniq ko'ringan Selfi Rasmingizni botga yuboring (Faqat rasm ko'rinishida):", kb_back);
  }

  if (session.state === 'REG_SELFIE' && msg.photo) {
    session.data.selfie = msg.photo[msg.photo.length - 1].file_id;
    pushHistory("6/7. Selfi Rasmingizni yuboring:", kb_back);
    session.state = 'REG_GENDER';
    saveDB();
    return clearAndSend(chatId, userId, "<b>7/7.</b> Jinsingizni belgilang:", kb_gender);
  }

  if (session.state === 'REG_GENDER' && (text === 'Erkak' || text === 'Ayol')) {
    session.data.gender = text;
    pushHistory("7/7. Jinsingizni belgilang:", kb_gender);
    
    // START STRUCTURAL SELECTION BY REGIONS
    if (db.structure.regions.length === 0) {
      session.state = 'IDLE'; saveDB();
      return clearAndSend(chatId, userId, "⚠️ Tizimda hali viloyatlar sozlanmagan. Iltimos keyinroq urinib ko'ring.", kb_start_guest);
    }
    
    let inline_keyboard = [];
    db.structure.regions.forEach(reg => {
      inline_keyboard.push([{ text: `🚩 ${reg.name}`, callback_data: `regsel_${reg.id}` }]);
    });
    session.state = 'REG_SELECT_REGION'; saveDB();
    
    return clearAndSend(chatId, userId, "📍 Istiqomat qilmoqchi bo'lgan <b>Viloyatni</b> tanlang:", { reply_markup: { inline_keyboard } });
  }

  if (text === '🏨 HOSTEL bilan tanishish') {
    return clearAndSend(chatId, userId, db.settings.hostel_tanishuv, isKvartirant(userId) ? kb_start_kvartirant : kb_start_guest);
  }
  if (text === '🛂 HOSTEL Qoidalar' || text === '📜 Qoidalar') {
    return clearAndSend(chatId, userId, db.settings.hostel_qoidalar, isKvartirant(userId) ? kb_start_kvartirant : kb_start_guest);
  }

  // ==========================================
  // KVARTIRANT OPERATIONS
  // ==========================================
  if (isKvartirant(userId)) {
    if (text === '📅 Ijara Muddati') {
      const kv = db.kvartirantlar[userId];
      return clearAndSend(chatId, userId, `📅 <b>Sizning Ijara Muddatlaringiz:</b>\n\n🛫 Kelgan Sana: ${kv.start_date}\n🛬 Tugash Sana: ${kv.end_date}\n📊 Holat: ${kv.status === 'aktiv' ? '🟢 AKTIV' : '⚠️ QARZDOR'}`, kb_start_kvartirant);
    }
    if (text === '💳 Karta Raqam') {
      return clearAndSend(chatId, userId, `💳 <b>To'lovlar uchun Karta rekvizitlari:</b>\n\n📌 Karta Raqami: <code>${db.settings.karta_raqam}</code>\n👤 Ega: <b>${db.settings.karta_ega}</b>\n\n<i>Nusxa olish uchun karta raqam ustiga bosing.</i>`, kb_start_kvartirant);
    }
    if (text === '💵 Toʻlov qilish') {
      pushHistory("Kvartirant paneli", kb_start_kvartirant);
      session.state = 'KV_PAY_TYPE'; saveDB();
      let inline_keyboard = [
        [{ text: "📅 Oylik to'lov", callback_data: "kvpay_month" }],
        [{ text: "⛅ Kunlik to'lov", callback_data: "kvpay_days" }]
      ];
      return clearAndSend(chatId, userId, "To'lov turini tanlang:", { reply_markup: { inline_keyboard } });
    }
    if (session.state === 'KV_SEND_CHECK' && msg.photo) {
      const check_photo = msg.photo[msg.photo.length - 1].file_id;
      const kv = db.kvartirantlar[userId];
      
      const r_id = generateShortId('req');
      db.pending_requests[r_id] = {
        user_id: userId,
        type: 'EXISTING_KV_CHECK',
        data: { check: check_photo, pay_type: session.data.pay_method, amount: session.data.calculated_amount, end_date: session.data.new_end_date },
        admin_msgs: []
      };
      saveDB();
      
      // Notify all admins with multiple photos logic (Visual Sync)
          const adm_text = `🔔 <b>HOSTEL KVARTIRANTI TOʻLOVI</b>\n\n💵 <b>Toʻlov turi :</b> 💳 Karta orqali\n🤝 <b>Toʻlov Summasi :</b> ${session.data.calculated_amount} so'm\n👤 <b>F.I.SH :</b> ${kv.fio}\n📞 <b>Tel Raqami:</b> ${kv.phone}\n📅 <b>Yangi Ijara Muddati :</b> ${session.data.new_end_date}`;
      const inline_adm = {
        inline_keyboard: [[{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }], [{ text: "✅ Tasdiqlash", callback_data: `aprv_ex_${r_id}` }, { text: "❌ Rad etish", callback_data: `den_ex_${r_id}` }]]
      };

      for (const adm of db.admins) {
        try {
          // Send selfie and check together conceptually or via media group, instructions requested photo control
          await bot.sendPhoto(adm, check_photo, { caption: adm_text, reply_markup: inline_adm });
        } catch(e){}
      }
      
      session.state = 'IDLE'; saveDB();
      return clearAndSend(chatId, userId, "✅ Toʻlov skrinshoti yuborildi. Iltimos Admin tasdig'ini kuting.", kb_start_kvartirant);
    }
    
    if (text === '🛂 Adminga murojat yoʻllash') {
      pushHistory("Kvartirant paneli", kb_start_kvartirant);
      session.state = 'KV_MUROJAAT'; saveDB();
      return clearAndSend(chatId, userId, "📝 Adminga yo'llamoqchi bo'lgan murojaatingiz matnini chatga yozib yuboring:", kb_back);
    }
    if (session.state === 'KV_MUROJAAT') {
      const m_text = text.trim();
      const kv = db.kvartirantlar[userId];
      
      const m_id = generateShortId('mur');
      db.pending_requests[m_id] = { user_id: userId, type: 'MUROJAAT', admin_msgs: [] };
      saveDB();
      
      const adm_m_text = `📨 <b>MUROJAT NOMA</b>\n\n👤 <b>F.I.SH :</b> ${kv.fio}\n📅 <b>Tugʻilgan sanasi :</b> ${kv.bdate}\n🪪 <b>Pasport Seriyasi :</b> ${kv.passport}\n🆔 <b>JSHSHIR Raqami :</b> ${kv.jshshir}\n📞 <b>Tel Raqami:</b> ${kv.phone}\n📨 <b>Murojat noma :</b> ${m_text}`;
      const inline_m = {
        inline_keyboard: [[{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }], [{ text: "✅ Murojat noma qabul qilindi", callback_data: `murojaat_ok_${m_id}` }]]
      };
      
      for (const admId of db.admins) {
        try {
          let s_msg;
          if (kv.selfie) {
            s_msg = await bot.sendPhoto(admId, kv.selfie, { caption: adm_m_text, reply_markup: inline_m });
          } else {
            s_msg = await bot.sendMessage(admId, adm_m_text, { reply_markup: inline_m });
          }
          if(s_msg) db.pending_requests[m_id].admin_msgs.push({ chat_id: admId, message_id: s_msg.message_id });
        } catch(e){}
      }
      session.state = 'IDLE'; saveDB();
      return clearAndSend(chatId, userId, "✅ Murojaatingiz barcha adminlarga muvaffaqiyatli yetkazildi.", kb_start_kvartirant);
    }
  }

  // --- SUBMISSION RECEPTION SYSTEM FOR SKRINSHOTS ---
  if (session.state === 'REG_SEND_CHECK' && msg.photo) {
    session.data.check_photo = msg.photo[msg.photo.length - 1].file_id;
    pushHistory("To'lov isboti talabi", kb_back);
    
    const r_id = generateShortId('req');
    db.pending_requests[r_id] = { user_id: userId, type: 'NEW_REG', data: session.data, admin_msgs: [] };
    saveDB();
    
    // Format payload data string
    const target_text = `🔔 <b>YANGI KVARTIRANT TOʻLOVI</b>\n\n💵 <b>Toʻlov turi :</b> 💳 Karta orqali\n🤝 <b>Toʻlov Summasi :</b> ${session.data.price} so'm\n👤 <b>(F.I.SH) :</b> ${session.data.fio}\n📅 <b>Tugʻilgan sanasi :</b> ${session.data.bdate}\n🪪 <b>Pasport Seriyasi :</b> ${session.data.passport}\n🆔 <b>JSHSHIR Raqami :</b> ${session.data.jshshir}\n📞 <b>Tel Raqami:</b> ${session.data.phone}\n📅 <b>Ijara Muddati :</b> ${session.data.end_date}`;
    const inline_adm = {
      inline_keyboard: [[{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }], [{ text: "✅ Tasdiqlash", callback_data: `aprv_${r_id}` }, { text: "❌ Rad etish", callback_data: `den_${r_id}` }]]
    };

    for (const adm of db.admins) {
      try {
        let sentM = await bot.sendPhoto(adm, session.data.check_photo, { caption: target_text, reply_markup: inline_adm });
        if(sentM) db.pending_requests[r_id].admin_msgs.push({ chat_id: adm, message_id: sentM.message_id });
      } catch(e){}
    }
    
    session.state = 'IDLE'; session.data = {}; saveDB();
    return clearAndSend(chatId, userId, "Soʻrovingiz Adminga yuborildi iltimos Admin javobini kuting.", kb_start_guest);
  }

      // ==========================================
  // ADMIN PANEL LOGIC PROCESSORS
  // ==========================================
  if (isAdmin(userId) && session.state.startsWith('ADMIN_')) {
    if (text === '📊 STATISTIKA') {
      let act = 0, male = 0, female = 0, qarz = 0, qarz_sum = 0;
      for (let k in db.kvartirantlar) {
        let kv = db.kvartirantlar[k];
        if (kv.status === 'aktiv') {
          act++;
          if (kv.gender === 'Erkak') male++; else female++;
        }
        if (kv.status === 'qarz') {
          qarz++;
          qarz_sum += Number(kv.monthlyPrice || 0);
        }
      }
      const totalBeds = db.structure.beds.length;
      const freeBeds = db.structure.beds.filter(b => b.status === 'bosh').length;
      const stat_text = `📊 <b>HOSTEL STATISTIKASI</b>\n\nViloyatlar soni: ${db.structure.regions.length}\nFiliallar soni: ${db.structure.branches.length}\n\n👥 <b>Aktiv Kvartirantlar :</b> ${act} ta\nErkaklar — ${male}\nAyollar — ${female}\n\n🛏 <b>Boʻsh yotoqlar :</b> ${freeBeds} ta / ${totalBeds} jami\n📉 <b>Qarzdorlar soni:</b> ${qarz} kishi\n💰 <b>Olinmagan qarzlar:</b> ${qarz_sum} so'm\n\n👉👤 <b>Bu Oyda qoʻshildi:</b> ${db.monthly_counter} ta`;
      return clearAndSend(chatId, userId, stat_text, kb_admin_panel);
    }

    if (text === '💳 Karta Sozlamalari') {
      pushHistory("Admin boshqaruv paneli", kb_admin_panel);
      session.state = 'ADMIN_SET_CARD_NUM'; saveDB();
      return clearAndSend(chatId, userId, `Joriy karta: <code>${db.settings.karta_raqam}</code> / ${db.settings.karta_ega}\n\nYangi karta raqamini yozing:`, kb_back);
    }
    if (session.state === 'ADMIN_SET_CARD_NUM') {
      session.data.card_num = text.trim();
      session.state = 'ADMIN_SET_CARD_EGA'; saveDB();
      return clearAndSend(chatId, userId, "Karta egasining ismini kiriting:", kb_back);
    }
    if (session.state === 'ADMIN_SET_CARD_EGA') {
      db.settings.karta_raqam = session.data.card_num;
      db.settings.karta_ega = text.trim();
      session.state = 'ADMIN_PANEL'; saveDB();
      return clearAndSend(chatId, userId, "✅ Karta ma'lumotlari muvaffaqiyatli yangilandi!", kb_admin_panel);
    }

    if (text === '📜 Qoida sozlash') {
      pushHistory("Admin boshqaruv paneli", kb_admin_panel);
      session.state = 'ADMIN_SET_RULES'; saveDB();
      return clearAndSend(chatId, userId, "Yangi HOSTEL qoidalarini matn ko'rinishida yozib yuboring:", kb_back);
    }
    if (session.state === 'ADMIN_SET_RULES') {
      db.settings.hostel_qoidalar = text.trim();
      session.state = 'ADMIN_PANEL'; saveDB();
      return clearAndSend(chatId, userId, "✅ Hostel qoidalari muvaffaqiyatli saqlandi!", kb_admin_panel);
    }

    if (text === '🏨 HOSTEL tanishuv sozlamalari') {
      pushHistory("Admin boshqaruv paneli", kb_admin_panel);
      session.state = 'ADMIN_SET_INTRO'; saveDB();
      return clearAndSend(chatId, userId, "Hostel tanishuv ma'lumotini yozib yuboring:", kb_back);
    }
    if (session.state === 'ADMIN_SET_INTRO') {
      db.settings.hostel_tanishuv = text.trim();
      session.state = 'ADMIN_PANEL'; saveDB();
      return clearAndSend(chatId, userId, "✅ Tanishuv ma'lumotlari muvaffaqiyatli o'zgartirildi!", kb_admin_panel);
    }

    if (text === '⛅ KUNLIK Toʻlovni sozlash') {
      pushHistory("Admin boshqaruv paneli", kb_admin_panel);
      session.state = 'ADMIN_SET_DAILY_PRICE'; saveDB();
      return clearAndSend(chatId, userId, `Joriy kunlik ijara narxi: ${db.settings.kunlik_narx} so'm.\nYangi narxni faqat raqamlarda kiriting:`, kb_back);
    }
    if (session.state === 'ADMIN_SET_DAILY_PRICE') {
      const val = parseInt(text.trim());
      if (isNaN(val)) return clearAndSend(chatId, userId, "Iltimos faqat raqam yozing:", kb_back);
      db.settings.kunlik_narx = val;
      session.state = 'ADMIN_PANEL'; saveDB();
      return clearAndSend(chatId, userId, `✅ Kunlik narx ${val} so'm qilib belgilandi!`, kb_admin_panel);
    }

    if (text === '👮‍♂️ Admin qoʻshish') {
      pushHistory("Admin boshqaruv paneli", kb_admin_panel);
      session.state = 'ADMIN_ADD_ADMIN_ID'; saveDB();
      return clearAndSend(chatId, userId, "Yangi admin qo'shish uchun uning Telegram ID raqamini yozing:", kb_back);
    }
    if (session.state === 'ADMIN_ADD_ADMIN_ID') {
      const admId = parseInt(text.trim());
      if (isNaN(admId)) return clearAndSend(chatId, userId, "Xato format. Faqat raqamli ID kiriting:", kb_back);
      if (!db.admins.includes(admId)) db.admins.push(admId);
      session.state = 'ADMIN_PANEL'; saveDB();
      return clearAndSend(chatId, userId, `✅ Foydalanuvchi ${admId} muvaffaqiyatli adminlar safiga qo'shildi!`, kb_admin_panel);
    }

    if (text === '📢 Xabarnoma') {
      pushHistory("Admin boshqaruv paneli", kb_admin_panel);
      session.state = 'ADMIN_BROADCAST'; saveDB();
      return clearAndSend(chatId, userId, "Barcha faol kvartirantlarga yuboriladigan reklama yoki e'lon matnini yozing:", kb_back);
    }
    if (session.state === 'ADMIN_BROADCAST') {
      const b_text = text.trim();
      session.state = 'ADMIN_PANEL'; saveDB();
      let count = 0;
      for (let k in db.kvartirantlar) {
        bot.sendMessage(k, `📢 <b>ADMINOSTRATSIYA XABARI:</b>\n\n${b_text}`, { parse_mode: 'HTML' }).catch(()=>{});
        count++;
      }
      return clearAndSend(chatId, userId, `✅ E'lon muvaffaqiyatli ${count} ta kvartirantga yuborildi!`, kb_admin_panel);
    }

    // --- HOSTEL STRUCTURAL CREATION INTERFACE ---
    if (text === '🏨 HOSTEL Sozlash') {
      pushHistory("Admin boshqaruv paneli", kb_admin_panel);
      let inline_keyboard = [
        [{ text: "➕ Viloyat qo'shish", callback_data: "add_struct_region" }],
        [{ text: "➕ Filial qo'shish", callback_data: "add_struct_branch" }],
        [{ text: "➕ Xona qo'shish", callback_data: "add_struct_room" }],
        [{ text: "➕ Yotoq qo'shish", callback_data: "add_struct_bed" }]
      ];
      return clearAndSend(chatId, userId, "Hostel arxitektura sozlash bo'limi:", { reply_markup: { inline_keyboard } });
    }

    if (session.state === 'ADMIN_INPUT_REGION') {
      const r_id = generateShortId('v');
      db.structure.regions.push({ id: r_id, name: text.trim() });
      session.state = 'ADMIN_PANEL'; saveDB();
      const inline_v = { inline_keyboard: [[{ text: `📍 ${text.trim()}`, callback_data: `v_info_${r_id}` }]] };
      return clearAndSend(chatId, userId, `✅ Viloyat muvaffaqiyatli qo'shildi va tizim tugmasiga biriktirildi:`, inline_v);
    }
    if (session.state === 'ADMIN_INPUT_BRANCH') {
      const f_id = generateShortId('f');
      db.structure.branches.push({ id: f_id, region_id: session.data.selected_reg, name: text.trim() });
      session.state = 'ADMIN_PANEL'; saveDB();
      return clearAndSend(chatId, userId, `✅ Yangi filial muvaffaqiyatli saqlandi: <b>${text.trim()}</b>`, kb_admin_panel);
    }
    if (session.state === 'ADMIN_INPUT_ROOM') {
      const x_id = generateShortId('x');
      db.structure.rooms.push({ id: x_id, branch_id: session.data.selected_br, room_number: text.trim() });
      session.state = 'ADMIN_PANEL'; saveDB();
      return clearAndSend(chatId, userId, `✅ Xona muvaffaqiyatli yaratildi: <b>${text.trim()}-xona</b>`, kb_admin_panel);
    }
    if (session.state === 'ADMIN_INPUT_BED_NUM') {
      session.data.bed_num = text.trim();
      session.state = 'ADMIN_INPUT_BED_PRICE'; saveDB();
      return clearAndSend(chatId, userId, "💰 Ushbu yotoq (койка) uchun oylik ijara narxini kiriting (faqat raqamda):", kb_back);
    }
    if (session.state === 'ADMIN_INPUT_BED_PRICE') {
      const p_val = parseInt(text.trim());
      if (isNaN(p_val)) return clearAndSend(chatId, userId, "Iltimos faqat raqam kiriting:", kb_back);
      const y_id = generateShortId('y');
      db.structure.beds.push({ id: y_id, room_id: session.data.selected_rm, bed_number: session.data.bed_num, price: p_val, status: 'bosh', user_id: null });
      session.state = 'ADMIN_PANEL'; saveDB();
      return clearAndSend(chatId, userId, "✅ Yangi yotoq joyi narxi va parametrlar tizimiga muvaffaqiyatli ulandi!", kb_admin_panel);
    }
    if (session.state === 'ADMIN_INPUT_ESLATMA') {
      const esl_text = text.trim();
      const t_uid = session.data.eslatma_uid;
      if (db.kvartirantlar[t_uid]) {
        db.kvartirantlar[t_uid].eslatma = esl_text;
        saveDB();
        
        // Dynamic re-sync on respective storage groups (/aktiv or /qarz)
        const kv = db.kvartirantlar[t_uid];
        const updated_text = `${kv.status === 'aktiv' ? '✅ <b>AKTIV  KVARTIRANT</b>' : '⚠️ <b>QARZDOR Kvartirant</b>'}\n\n👤 <b>F.I.SH:</b> ${kv.fio}\n📅 <b>Tugʻilgan sanasi:</b> ${kv.bdate}\n🪪 <b>Pasport Seriyasi:</b> ${kv.passport}\n🆔 <b>JSHSHIR Raqami:</b> ${kv.jshshir}\n📞 <b>Tel Raqami:</b> ${kv.phone}\n📅 <b>Ijara Muddati:</b> ${kv.end_date}\n📌 <b>Eslatma:</b> ${kv.eslatma}`;
        const inline_ops = {
          inline_keyboard: [
            [{ text: "👤 Telegram Profili", url: `tg://user?id=${t_uid}` }],
            [{ text: "📌 Eslatma kiritish", callback_data: `eslatma_${t_uid}` }, { text: "❌ Kvartirant ketgan", callback_data: `ketgan_${t_uid}` }]
          ]
        };
        
        let targetGrp = kv.status === 'aktiv' ? db.settings.Aktiv_Guruh : db.settings.Qarz_Guruh;
        if (targetGrp && kv.group_msg_id) {
          try { await bot.editMessageCaption(updated_text, { chat_id: targetGrp, message_id: kv.group_msg_id, parse_mode: 'HTML', reply_markup: inline_ops }); } catch(e){}
        }
      }
      session.state = 'ADMIN_PANEL'; saveDB();
      return clearAndSend(chatId, userId, "✅ Eslatma kiritildi va saqlandi!", kb_admin_panel);
    }
  }
});
// ============================================================================
// ASOSIY CALLBACK HARAKATLARI METODLARI (CALLBACK_QUERY EVENT)
// ============================================================================
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;

  const session = initSession(userId);

  try {
    // --- GUEST SELECT REGION ---
    if (data.startsWith('regsel_')) {
      const r_id = data.replace('regsel_', '');
      session.data.selected_reg = r_id;
      
      const branches = db.structure.branches.filter(b => b.region_id === r_id);
      if (branches.length === 0) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Bu viloyatda filial mavjud emas!", show_alert: true });
        return;
      }
      
      let inline_keyboard = [];
      branches.forEach(br => {
        inline_keyboard.push([{ text: `🏨 ${br.name}`, callback_data: `brsel_${br.id}` }]);
      });
      session.state = 'REG_SELECT_BRANCH'; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("🏨 O'zingizga qulay bo'lgan <b>Filialni</b> tanlang:", { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
    }

    // --- GUEST SELECT BRANCH ---
    if (data.startsWith('brsel_')) {
      const f_id = data.replace('brsel_', '');
      session.data.selected_br = f_id;
      
      const rooms = db.structure.rooms.filter(r => r.branch_id === f_id);
      if (rooms.length === 0) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Bu filialda xonalar yo'q!", show_alert: true });
        return;
      }
      
      let inline_keyboard = [];
      rooms.forEach(rm => {
        inline_keyboard.push([{ text: `🚪 ${rm.room_number}-xona`, callback_data: `rmsel_${rm.id}` }]);
      });
      session.state = 'REG_SELECT_ROOM'; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("🚪 Kerakli <b>Xonani</b> belgilang:", { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
    }

    // --- GUEST SELECT ROOM ---
    if (data.startsWith('rmsel_')) {
      const x_id = data.replace('rmsel_', '');
      session.data.selected_rm = x_id;
      
      const beds = db.structure.beds.filter(b => b.room_id === x_id && b.status === 'bosh');
      if (beds.length === 0) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Ushbu xonada bo'sh joy qolmadi!", show_alert: true });
        return;
      }
      
      let inline_keyboard = [];
      beds.forEach(bd => {
        inline_keyboard.push([{ text: `🛏️ ${bd.bed_number} (${bd.price} so'm)`, callback_data: `bdsel_${bd.id}` }]);
      });
      session.state = 'REG_SELECT_BED'; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("🛏️ O'zingizga mos keladigan <b>Yotoq/Qavatni</b> tanlang:", { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
    }

    // --- GUEST SELECT BED ---
    if (data.startsWith('bdsel_')) {
      const y_id = data.replace('bdsel_', '');
      const bed = db.structure.beds.find(b => b.id === y_id);
      session.data.selected_bed = y_id;
      session.data.monthly_price = bed.price;
      
      let inline_keyboard = [
        [{ text: "💰 Oylik to'lov", callback_data: "payperiod_month" }],
        [{ text: "⛅ Kunlik muddat tanlash", callback_data: "payperiod_days" }]
      ];
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("📅 To'lov muddatini belgilang:", { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
    }

    // --- PAY PERIOD LOGIC ---
    if (data === 'payperiod_month') {
      session.data.pay_type = 'Oylik';
      session.data.price = session.data.monthly_price;
      
      let d = new Date();
      let formatStart = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
      d.setMonth(d.getMonth() + 1);
      let formatEnd = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
      
      session.data.start_date = formatStart;
      session.data.end_date = formatEnd;
      
      let inline_keyboard = [
        [{ text: "💳 Karta orqali", callback_data: "paym_card" }],
        [{ text: "💵 Naqd pul bilan", callback_data: "paym_cash" }]
      ];
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText(`Ijara muddati: ${formatStart} dan ${formatEnd} gacha.\nTo'lov turini belgilang:`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
    }

    if (data === 'payperiod_days') {
      let inline_keyboard = [];
      let row = [];
      for(let i=1; i<=10; i++){
        row.push({ text: `${i} Kun`, callback_data: `paydays_${i}` });
        if(row.length === 3 || i === 10){
          inline_keyboard.push(row);
          row = [];
        }
      }
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("Necha kunlik to'lov amalga oshirmoqchisiz:", { chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard } });
    }

    if (data.startsWith('paydays_')) {
      const days = parseInt(data.replace('paydays_', ''));
      session.data.pay_type = `${days} Kunlik`;
      session.data.price = db.settings.kunlik_narx * days;
      
      let d = new Date();
      let formatStart = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
      d.setDate(d.getDate() + days);
      let formatEnd = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
      
      session.data.start_date = formatStart;
      session.data.end_date = formatEnd;
      
      let inline_keyboard = [
        [{ text: "💳 Karta orqali", callback_data: "paym_card" }],
        [{ text: "💵 Naqd pul bilan", callback_data: "paym_cash" }]
      ];
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText(`Ijara muddati: ${formatStart} dan ${formatEnd} gacha (${days} kun).\nJami summa: ${session.data.price} so'm.\nTo'lov turini belgilang:`, { chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard } });
    }

    // --- METHODS ---
    if (data === 'paym_cash') {
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.deleteMessage(chatId, message.message_id);
      
      const r_id = generateShortId('req');
      db.pending_requests[r_id] = { user_id: userId, type: 'NEW_REG_CASH', data: session.data, admin_msgs: [] };
      saveDB();
      
      const cash_adm_text = `🔔 <b>YANGI KVARTIRANT TOʻLOVI</b>\n\n💵 <b>Toʻlov turi :</b> 💵 Naqd pul bilan\n🤝 <b>Toʻlov Summasi :</b> ${session.data.price} so'm\n👤 (F.I.SH) : ${session.data.fio}\n📅 Tugʻilgan sanasi : ${session.data.bdate}\n🪪 Pasport Seriyasi : ${session.data.passport}\n🆔 JSHSHIR Raqami : ${session.data.jshshir}\n📞 Tel Raqami: ${session.data.phone}\n📅 Ijara Muddati : ${session.data.end_date}\n\n😎 Pulni Qoʻlingizga olgandan soʻng 🤝\n ✅ Tasdiqlang...❕`;
      const inline_adm = {
        inline_keyboard: [[{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }], [{ text: "✅ Tasdiqlash", callback_data: `aprv_${r_id}` }, { text: "❌ Rad etish", callback_data: `den_${r_id}` }]]
      };

      for(const admId of db.admins){
        try {
          let sentM;
          if (session.data.selfie) {
            sentM = await bot.sendPhoto(admId, session.data.selfie, { caption: cash_adm_text, reply_markup: inline_adm });
          } else {
            sentM = await bot.sendMessage(admId, cash_adm_text, { reply_markup: inline_adm });
          }
          if(sentM) db.pending_requests[r_id].admin_msgs.push({ chat_id: admId, message_id: sentM.message_id });
        } catch(e){}
      }
      
      session.state = 'IDLE'; session.data = {}; saveDB();
      return bot.sendMessage(chatId, "Soʻrovingiz Adminga yuborildi naqd to'lovni tasdiqlashlarini kuting.", kb_start_guest);
    }

    if (data === 'paym_card') {
      session.state = 'REG_SEND_CHECK'; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText(`💳 <b>To'lov rekvizitlari:</b>\nKarta raqam: <code>${db.settings.karta_raqam}</code>\nEga: ${db.settings.karta_ega}\n\nIltimos to'lov qilib uning skrinshot(chek) rasmini chatga yuboring:`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML' });
    }

    // --- ADMINISTRATIVE CORE APPROVAL SYSTEM ---
    if (data.startsWith('aprv_') || data.startsWith('den_')) {
      let isApprove = data.startsWith('aprv_');
      let r_id = data.replace('aprv_', '').replace('den_', '');
      
      // Control existing sub types
      let isExisting = r_id.startsWith('ex_');
      if (isExisting) r_id = r_id.replace('ex_', '');
      
      const req = db.pending_requests[r_id];
      if (!req) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Ushbu ariza eskirgan yoki ko'rib chiqilgan!", show_alert: true });
        return;
      }
      
      await bot.answerCallbackQuery(callbackQuery.id);
      
      // Delete from all admin chats instantly (Multi-Admin Sync Action)
      req.admin_msgs.forEach(async (m) => {
        try { await bot.deleteMessage(m.chat_id, m.message_id); } catch(e){}
      });

      if (!isApprove) {
        await bot.sendMessage(req.user_id, "❌ Afsuski, sizning arizangiz yoki to'lovingiz admin tomonidan rad etildi.", kb_start_guest);
        delete db.pending_requests[r_id]; saveDB();
        return;
      }

      // --- ON APPROVAL SYSTEM LOGIC ---
      if (req.type === 'NEW_REG' || req.type === 'NEW_REG_CASH') {
        const d = req.data;
        db.kvartirantlar[req.user_id] = {
          fio: d.fio, bdate: d.bdate, phone: d.phone, passport: d.passport, jshshir: d.jshshir,
          selfie: d.selfie, gender: d.gender, bed_id: d.selected_bed, type: d.pay_type,
          start_date: d.start_date, end_date: d.end_date, pay_method: req.type==='NEW_REG'?'Karta':'Naqd',
          status: 'aktiv', eslatma: "Yo'q", group_msg_id: null
        };
        
        // Mark bed as busy
        const bed = db.structure.beds.find(b => b.id === d.selected_bed);
        if(bed) { bed.status = 'band'; bed.user_id = req.user_id; }
        db.monthly_counter++;
        saveDB();

        // Push data target inside /aktiv group storage
        if (db.settings.Aktiv_Guruh) {
          const akt_txt = `✅ <b>AKTIV  KVARTIRANT</b>\n\n👤 <b>F.I.SH:</b> ${d.fio}\n📅 <b>Tugʻilgan sanasi:</b> ${d.bdate}\n🪪 <b>Pasport Seriyasi:</b> ${d.passport}\n🆔 <b>JSHSHIR Raqami:</b> ${d.jshshir}\n📞 <b>Tel Raqami:</b> ${d.phone}\n📅 <b>Ijara Muddati:</b> ${d.end_date}\n📌 <b>Eslatma:</b> Yo'q`;
          const inline_akt = {
            inline_keyboard: [
              [{ text: "👤 Telegram Profili", url: `tg://user?id=${req.user_id}` }],
              [{ text: "📌 Eslatma kiritish", callback_data: `eslatma_${req.user_id}` }, { text: "❌ Kvartirant ketgan", callback_data: `ketgan_${req.user_id}` }]
            ]
          };
          
          if(d.selfie) {
            const grpSent = await bot.sendPhoto(db.settings.Aktiv_Guruh, d.selfie, { caption: akt_txt, parse_mode: 'HTML', reply_markup: inline_akt }).catch(()=>{});
            if(grpSent) db.kvartirantlar[req.user_id].group_msg_id = grpSent.message_id;
          } else {
            const grpSent = await bot.sendMessage(db.settings.Aktiv_Guruh, akt_txt, { parse_mode: 'HTML', reply_markup: inline_akt }).catch(()=>{});
            if(grpSent) db.kvartirantlar[req.user_id].group_msg_id = grpSent.message_id;
          }
          saveDB();
        }

        await bot.sendMessage(req.user_id, "🎉 Tabriklaymiz! Arizangiz tasdiqlandi va siz Tinchlik HOSTEL kvartirantiga aylandingiz.", kb_start_kvartirant);
      } 
      else if (req.type === 'EXISTING_KV_CHECK' || req.type === 'EXISTING_KV_CASH') {
        const kv = db.kvartirantlar[req.user_id];
        kv.end_date = req.data.end_date;
        kv.status = 'aktiv';
        saveDB();
        
        // Re-generate in aktiv group
        if (db.settings.Aktiv_Guruh) {
          const akt_txt = `✅ <b>AKTIV  KVARTIRANT</b>\n\n👤 <b>F.I.SH:</b> ${kv.fio}\n📅 <b>Tugʻilgan sanasi:</b> ${kv.bdate}\n🪪 <b>Pasport Seriyasi:</b> ${kv.passport}\n🆔 <b>JSHSHIR Raqami:</b> ${kv.jshshir}\n📞 <b>Tel Raqami:</b> ${kv.phone}\n📅 <b>Ijara Muddati:</b> ${kv.end_date}\n📌 <b>Eslatma:</b> ${kv.eslatma}`;
          const inline_akt = {
            inline_keyboard: [
              [{ text: "👤 Telegram Profili", url: `tg://user?id=${req.user_id}` }],
              [{ text: "📌 Eslatma kiritish", callback_data: `eslatma_${req.user_id}` }, { text: "❌ Kvartirant ketgan", callback_data: `ketgan_${req.user_id}` }]
            ]
          };
          if(kv.selfie) {
            await bot.sendPhoto(db.settings.Aktiv_Guruh, kv.selfie, { caption: akt_txt, parse_mode: 'HTML', reply_markup: inline_akt }).catch(()=>{});
          }
        }
        await bot.sendMessage(req.user_id, `✅ To'lovingiz tasdiqlandi! Ijara muddati ${kv.end_date} gacha uzaytirildi.`, kb_start_kvartirant);
      }

      delete db.pending_requests[r_id]; saveDB();
      return;
    }

    // --- OTHER INTERFACE CLICKS ---
    if (data.startsWith('eslatma_')) {
      const t_uid = data.replace('eslatma_', '');
      session.state = 'ADMIN_INPUT_ESLATMA';
      session.data.eslatma_uid = t_uid; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.sendMessage(userId, "Kiritmoqchi bo'lgan 📌 Eslatma xabaringizni Chatga yozib yuboring:");
    }

    if (data.startsWith('ketgan_')) {
      const t_uid = data.replace('ketgan_', '');
      const kv = db.kvartirantlar[t_uid];
      if(!kv) return;
      
      await bot.answerCallbackQuery(callbackQuery.id);
      try { await bot.deleteMessage(chatId, message.message_id); } catch(e){}
      
      // Release room seat structure settings
      const bed = db.structure.beds.find(b => b.id === kv.bed_id);
      if(bed) { bed.status = 'bosh'; bed.user_id = null; }
      
      kv.status = 'arxiv'; saveDB();
      
      if(db.settings.Ketgan_Guruh) {
        let todayStr = new Date().toLocaleDateString('ru-RU');
        const ket_txt = `⛔️ <b>KETGAN Kvartirant</b>\n\n👤 <b>F.I.SH:</b> ${kv.fio}\n📅 <b>Tugʻilgan sanasi:</b> ${kv.bdate}\n🪪 <b>Pasport Seriyasi:</b> ${kv.passport}\n🆔 <b>JSHSHIR Raqami:</b> ${kv.jshshir}\n📞 <b>Tel Raqami:</b> ${kv.phone}\n📅 <b>Kelgan muddati:</b> ${kv.start_date}\n📅 <b>Ketgan muddati:</b> ${todayStr}\n📌 <b>Eslatma:</b> ${kv.eslatma}`;
        if(kv.selfie) {
          await bot.sendPhoto(db.settings.Ketgan_Guruh, kv.selfie, { caption: ket_txt, parse_mode: 'HTML' });
        }
      }
      return;
    }

    // --- STRUCTURAL CALLBACK ADDS FOR ADMIN ---
    if (data === 'add_struct_region') {
      session.state = 'ADMIN_INPUT_REGION'; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.sendMessage(userId, "📝 Yangi qo'shmoqchi bo'lgan Viloyatingiz nomini yozing:");
    }

    if (data === 'add_struct_branch') {
      if(db.structure.regions.length===0) return bot.answerCallbackQuery(callbackQuery.id, { text: "Avval viloyat qo'shing!", show_alert:true });
      let inline_keyboard = [];
      db.structure.regions.forEach(r => {
        inline_keyboard.push([{ text: r.name, callback_data: `adbr_r_${r.id}` }]);
      });
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("Qaysi viloyatga yangi Filial qo'shmoqchisiz:", { chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard } });
    }
    if (data.startsWith('adbr_r_')) {
      session.data.selected_reg = data.replace('adbr_r_', '');
      session.state = 'ADMIN_INPUT_BRANCH'; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.sendMessage(userId, "Endi qo'shiladigan Filial nomini yozing:");
    }

    if (data === 'add_struct_room') {
      if(db.structure.branches.length===0) return bot.answerCallbackQuery(callbackQuery.id, { text: "Avval filial qo'shing!", show_alert:true });
      let inline_keyboard = [];
      db.structure.branches.forEach(b => {
        inline_keyboard.push([{ text: b.name, callback_data: `adrm_b_${b.id}` }]);
      });
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("Qaysi filialga yangi Xona qo'shmoqchisiz:", { chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard } });
    }
    if (data.startsWith('adrm_b_')) {
      session.data.selected_br = data.replace('adrm_b_', '');
      session.state = 'ADMIN_INPUT_ROOM'; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.sendMessage(userId, "Endi qo'shiladigan Xona raqamini kiriting:");
    }

    if (data === 'add_struct_bed') {
      if(db.structure.branches.length===0) return bot.answerCallbackQuery(callbackQuery.id, { text: "Avval filial tanlang!", show_alert:true });
      let inline_keyboard = [];
      db.structure.branches.forEach(b => {
        inline_keyboard.push([{ text: b.name, callback_data: `adbd_b_${b.id}` }]);
      });
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("Yangi yotoq uchun dastlab <b>Filialni</b> tanlang:", { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
    }
    if (data.startsWith('adbd_b_')) {
      const f_id = data.replace('adbd_b_', '');
      const rooms = db.structure.rooms.filter(r => r.branch_id === f_id);
      let inline_keyboard = [];
      rooms.forEach(rm => {
        inline_keyboard.push([{ text: `${rm.room_number}-xona`, callback_data: `adbd_r_${rm.id}` }]);
      });
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("Endi esa <b>Xonani</b> tanlang:", { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
    }
    if (data.startsWith('adbd_r_')) {
      session.data.selected_rm = data.replace('adbd_r_', '');
      session.state = 'ADMIN_INPUT_BED_NUM'; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.sendMessage(userId, "Qo'shilayotgan yangi yotoq (койка) raqamini kiriting:");
    }

    // --- EXISTING KVARTIRANT RE-PAYMENT FLOWS ---
    if (data === 'kvpay_month') {
      const kv = db.kvartirantlar[userId];
      const bed = db.structure.beds.find(b => b.id === kv.bed_id);
      session.data.pay_method = 'Karta';
      session.data.calculated_amount = bed.price;
      
      let [d, m, y] = kv.end_date.split('.');
      let currentExp = new Date(y, m - 1, d);
      currentExp.setMonth(currentExp.getMonth() + 1);
      session.data.new_end_date = `${String(currentExp.getDate()).padStart(2,'0')}.${String(currentExp.getMonth()+1).padStart(2,'0')}.${currentExp.getFullYear()}`;
      
      session.state = 'KV_SEND_CHECK'; saveDB();
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText(`Rekvizitlar:\nKarta: <code>${db.settings.karta_raqam}</code>\nEga: ${db.settings.karta_ega}\n\nTo'lov summasi: ${bed.price} so'm.\nTo'lov chekini rasm holatida yuboring:`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML' });
    }

  } catch (err) {
    console.error("Callback ishlash jarayonida global xato:", err);
  }
});

console.log("🚀 Tinchlik Hostel CRM Professional Engine is fully synchronized and activated on production!");
    
