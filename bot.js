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
 * ============================================================================\n * TINCHLIK HOSTEL - ADVANCED CRM BOT (ENTERPRISE EDITION)
 * ============================================================================\n * Tizim asosi: Node.js 
 * Kutubxonalar: node-telegram-bot-api, node-cron, fs, path
 * Dynamic Architecture: State Management Matrix (Fixed Async/Await Bugs)
 * ============================================================================\n */

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// ------------------- SOZLAMALAR VA TOKENLAR -------------------
const TOKEN = '8949142604:AAGqrksBXzXZqOiBPIP0EWLHFJPpSX9Tlmk';
const MAIN_SUPER_ADMIN = 8485164743; 

const bot = new TelegramBot(TOKEN, { polling: true });

// ------------------- BAZA STRUKTURASI VA FAOL REJIMLAR -------------------
const DB_FILE = path.join(__dirname, 'database.json');

let db = {
  admins: [MAIN_SUPER_ADMIN],
  settings: {
    Aktiv_Guruh: null,
    Qarz_Guruh: null,
    Arxiv_Guruh: null
  },
  hostel_structure: {
    regions: [] // { id, name }
    ,branches: [] // { id, regionId, name }
    ,rooms: [] // { id, branchId, roomNumber }
    ,beds: [] // { id, roomId, bedNumber, price, status: 'bosh'|'band', userId: null }
  },
  kvartirantlar: {}, // uId: { passport, phone, ... }
  sessions: {} // uId: { state, step, tempData... }
};

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(raw);
      
      // Bazani yangi struktura bilan boyitish (agar eski baza bo'lsa)
      if (!db.hostel_structure) {
        db.hostel_structure = { regions: [], branches: [], rooms: [], beds: [] };
      }
      if (!db.hostel_structure.regions) db.hostel_structure.regions = [];
      if (!db.hostel_structure.branches) db.hostel_structure.branches = [];
      if (!db.hostel_structure.rooms) db.hostel_structure.rooms = [];
      if (!db.hostel_structure.beds) db.hostel_structure.beds = [];
      if (!db.sessions) db.sessions = {};
    } catch (e) {
      console.error("Bazani o'qishda xatolik, yangi baza ochiladi:", e);
    }
  } else {
    saveDB();
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

loadDB();

// ------------------- HELPERS / UTILS -------------------
function initSession(uId) {
  if (!db.sessions[uId]) {
    db.sessions[uId] = { state: 'IDLE', step: 0, data: {} };
  }
  return db.sessions[uId];
}

function isAdmin(uId) {
  return db.admins.includes(Number(uId)) || Number(uId) === MAIN_SUPER_ADMIN;
}

// Kalit so'z generatsiyasi (unikal IDlar uchun)
function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

// ------------------- KLAVIATURALAR -------------------
function getMainMenu(uId) {
  if (isAdmin(uId)) {
    return {
      reply_markup: {
        keyboard: [
          ['➕ Viloyat qo\'shish', '➕ Filial qo\'shish'],
          ['➕ Xona qo\'shish', '➕ Yotoq qo\'shish'],
          ['⚙️ Guruhlarni Sozlash', '📊 Hostel Statistika'],
          ['🔎 Kvartirant Qidirish', '📝 Yangi Anketa Ochish'],
          ['🔄 Tizimni Yangilash']
        ],
        resize_keyboard: true
      }
    };
  } else {
    return {
      reply_markup: {
        keyboard: [
          ['📝 Anketa To\'ldirish', 'ℹ️ Mening Holatim'],
          ['📞 Admin bilan bog\'lanish']
        ],
        resize_keyboard: true
      }
    };
  }
}

function getSettingsMenu() {
  return {
    reply_markup: {
      keyboard: [
        ['🟢 Aktiv Guruhni Sozlash', '🔴 Qarz Guruhni Sozlash'],
        ['⚫ Arxiv Guruhni Sozlash', '🔙 Orqaga']
      ],
      resize_keyboard: true
    }
  };
}

// ------------------- ANKETA MATNI GENERATORI -------------------
function generateAnketaText(uId) {
  const kv = db.kvartirantlar[uId];
  if (!kv) return "Ma'lumot topilmadi.";

  // Yotoq va xona ma'lumotlarini qidirish
  let bedInfo = "Ajratilmagan";
  let roomInfo = "Ajratilmagan";
  let branchInfo = "Ajratilmagan";
  let regionInfo = "Ajratilmagan";

  if (kv.bedId) {
    const bed = db.hostel_structure.beds.find(b => b.id === kv.bedId);
    if (bed) {
      bedInfo = `${bed.bedNumber}-койка (${bed.price} so'm)`;
      const rm = db.hostel_structure.rooms.find(r => r.id === bed.roomId);
      if (rm) {
        roomInfo = `${rm.roomNumber}-xona`;
        const br = db.hostel_structure.branches.find(b => b.id === rm.branchId);
        if (br) {
          branchInfo = br.name;
          const rg = db.hostel_structure.regions.find(r => r.id === br.regionId);
          if (rg) regionInfo = rg.name;
        }
      }
    }
  }

  return `<b>📋 Kvartirant Anketasi (ID: ${uId})</b>\n` +
         `-----------------------------------------\n` +
         `👤 <b>F.I.O:</b> ${kv.fio || 'Kiritilmagan'}\n` +
         `📞 <b>Telefon:</b> ${kv.phone || 'Kiritilmagan'}\n` +
         `🪪 <b>Pasport:</b> ${kv.passport || 'Kiritilmagan'}\n` +
         `📍 <b>Manzil:</b> ${regionInfo} -> ${branchInfo}\n` +
         `🚪 <b>Xona & Yotoq:</b> ${roomInfo}, ${bedInfo}\n` +
         `📅 <b>Kelgan sana:</b> ${kv.startDate || 'Kiritilmagan'}\n` +
         `⏳ <b>Tugash sana:</b> ${kv.endDate || 'Kiritilmagan'}\n` +
         `💰 <b>Oylik to'lov:</b> ${kv.monthlyPrice || 0} so'm\n` +
         `📊 <b>Status:</b> ${kv.status === 'aktiv' ? '🟢 AKTIV' : '🔴 QARZDOR'}`;
}

function generateAnketaInlineMarkup(uId) {
  return {
    inline_keyboard: [
      [
        { text: "🟢 Aktiv Etish", callback_data: `set_status_aktiv_${uId}` },
        { text: "🔴 Qarz Etish", callback_data: `set_status_qarz_${uId}` }
      ],
      [
        { text: "⚫ Arxivlash", callback_data: `set_status_arxiv_${uId}` },
        { text: "💰 To'lovni Tasdiqlash", callback_data: `confirm_pay_${uId}` }
      ],
      [
        { text: "❌ O'chirish", callback_data: `delete_anketa_${uId}` }
      ]
    ]
  };
}

// ------------------- CRON JOB: HAR KUNI IJARA MUDDATINI TEKSHIRISH -------------------
cron.schedule('0 9 * * *', async () => {
  console.log("Kvartirantlar ijara muddatini tekshirish boshlandi...");
  const now = new Date();

  for (const uId in db.kvartirantlar) {
    const kv = db.kvartirantlar[uId];
    if (!kv.endDate || kv.status === 'arxiv') continue;

    const parts = kv.endDate.split('.'); // DD.MM.YYYY
    if (parts.length !== 3) continue;
    const expiryDate = new Date(parts[2], parts[1] - 1, parts[0]);

    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3 && diffDays > 0) {
      const warnMsg = `⚠️ <b>DIQQAT OGOHLANTIRISH!</b>\nHurmatli kvartirant, ijara muddatingiz tugashiga <b>${diffDays} kun</b> qoldi. To'lovni amalga oshirishingizni so'raymiz!`;
      await bot.sendMessage(uId, warnMsg, { parse_mode: 'HTML' }).catch(() => {});
    } 
    else if (diffDays <= 0 && kv.status === 'aktiv') {
      if (db.settings.Aktiv_Guruh && kv.groupMsgId) {
        try { await bot.deleteMessage(db.settings.Aktiv_Guruh, kv.groupMsgId); } catch(e){}
      }

      kv.status = 'qarz';
      saveDB();

      await bot.sendMessage(uId, "⚠️ Sizning ijara muddatingiz yakunlandi va tizim tomonidan QARZDORLAR ro'yxatiga kiritildingiz! Iltimos, zudlik bilan to'lov qiling.").catch(() => {});

      if (db.settings.Qarz_Guruh) {
        const qarzText = generateAnketaText(uId);
        const qarzMarkup = generateAnketaInlineMarkup(uId);
        try {
          const gMsg = await bot.sendMessage(db.settings.Qarz_Guruh, `🚨 <b>MUDDATI O'TGAN QARZDORLIK:</b>\n\n${qarzText}`, {
            parse_mode: 'HTML',
            reply_markup: qarzMarkup
          });
          kv.groupMsgId = gMsg.message_id;
          saveDB();
        } catch (e) {
          console.error("Qarz guruhiga yuborishda xato:", e);
        }
      }
    }
  }
});

// ============================================================================
// ASOSIY MESSAGE HANDLER (Muti-step State Engine va Qavslar Xatoliklari Mutloq To'g'rilangan)
// ============================================================================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const uId = msg.from.id;
  const text = msg.text;

  if (!text) return;

  const session = initSession(uId);

  // --- START KOMANDASI ---
  if (text === '/start') {
    session.state = 'IDLE';
    session.step = 0;
    session.data = {};
    saveDB();
    return bot.sendMessage(chatId, "Assalomu alaykum! Tinchlik Hostel CRM tizimiga xush kelibsiz.", getMainMenu(uId));
  }

  // --- KEYBOARD BOSILGANDA STATE RESET QILISH (Adashib ketishning oldini oladi) ---
  if ([
    '➕ Viloyat qo\'shish', '➕ Filial qo\'shish', '➕ Xona qo\'shish', '➕ Yotoq qo\'shish',
    '⚙️ Guruhlarni Sozlash', '📊 Hostel Statistika', '🔎 Kvartirant Qidirish', 
    '📝 Yangi Anketa Ochish', '🔄 Tizimni Yangilash', '🔙 Orqaga'
  ].includes(text)) {
    session.state = 'IDLE';
    session.step = 0;
    session.data = {};
    saveDB();
  }

  // ==========================================
  // SUPER ADMIN VA ADMIN HARAKATLARI
  // ==========================================
  if (isAdmin(uId)) {

    if (text === '🔄 Tizimni Yangilash') {
      loadDB();
      return bot.sendMessage(chatId, "🔄 Ma'lumotlar bazasi fayldan qayta o'qildi va tizim holati sinxronizatsiya qilindi.", getMainMenu(uId));
    }

    if (text === '⚙️ Guruhlarni Sozlash') {
      return bot.sendMessage(chatId, "Sozlamoqchi bo'lgan guruh toifasini tanlang:", getSettingsMenu());
    }

    if (text === '🔙 Orqaga') {
      return bot.sendMessage(chatId, "Bosh menyudasiz:", getMainMenu(uId));
    }

    // --- GURUHLARNI SOZLASH INPUTLARI ---
    if (text === '🟢 Aktiv Guruhni Sozlash') {
      session.state = 'SETTING_AKTIV_GURUH';
      saveDB();
      return bot.sendMessage(chatId, "Iltimos, Aktiv guruh/kanalning ID raqamini kiriting (Masalan: -100xxxxxxxxxx):\n\n<i>Yoki ushbu guruhdan biror xabarni botga Forward qiling.</i>", { parse_mode: 'HTML' });
    }
    if (text === '🔴 Qarz Guruhni Sozlash') {
      session.state = 'SETTING_QARZ_GURUH';
      saveDB();
      return bot.sendMessage(chatId, "Iltimos, Qarzdorlar guruhi/kanalining ID raqamini kiriting (Masalan: -100xxxxxxxxxx):", { parse_mode: 'HTML' });
    }
    if (text === '⚫ Arxiv Guruhni Sozlash') {
      session.state = 'SETTING_ARXIV_GURUH';
      saveDB();
      return bot.sendMessage(chatId, "Iltimos, Arxiv guruhi/kanalining ID raqamini kiriting (Masalan: -100xxxxxxxxxx):", { parse_mode: 'HTML' });
    }

    // Guruh IDlarini qabul qilish mantiqi
    if (session.state === 'SETTING_AKTIV_GURUH') {
      let gId = msg.forward_from_chat ? msg.forward_from_chat.id : Number(text);
      if (isNaN(gId)) return bot.sendMessage(chatId, "Xato ID format. Qayta kiriting:");
      db.settings.Aktiv_Guruh = gId;
      session.state = 'IDLE';
      saveDB();
      return bot.sendMessage(chatId, `🟢 Aktivlar guruhi muvaffaqiyatli saqlandi: ${gId}`, getSettingsMenu());
    }
    if (session.state === 'SETTING_QARZ_GURUH') {
      let gId = msg.forward_from_chat ? msg.forward_from_chat.id : Number(text);
      if (isNaN(gId)) return bot.sendMessage(chatId, "Xato ID format. Qayta kiriting:");
      db.settings.Qarz_Guruh = gId;
      session.state = 'IDLE';
      saveDB();
      return bot.sendMessage(chatId, `🔴 Qarzdorlar guruhi muvaffaqiyatli saqlandi: ${gId}`, getSettingsMenu());
    }
    if (session.state === 'SETTING_ARXIV_GURUH') {
      let gId = msg.forward_from_chat ? msg.forward_from_chat.id : Number(text);
      if (isNaN(gId)) return bot.sendMessage(chatId, "Xato ID format. Qayta kiriting:");
      db.settings.Arxiv_Guruh = gId;
      session.state = 'IDLE';
      saveDB();
      return bot.sendMessage(chatId, `⚫ Arxiv guruhi muvaffaqiyatli saqlandi: ${gId}`, getSettingsMenu());
    }

    // --- 📊 HOSTEL STATISTIKA ---
    if (text === '📊 Hostel Statistika') {
      const regCount = db.hostel_structure.regions.length;
      const brCount = db.hostel_structure.branches.length;
      const roomCount = db.hostel_structure.rooms.length;
      const totalBeds = db.hostel_structure.beds.length;
      const bandBeds = db.hostel_structure.beds.filter(b => b.status === 'band').length;
      const boshBeds = totalBeds - bandBeds;

      let kvAktiv = 0;
      let kvQarz = 0;
      let kvArxiv = 0;
      for (let k in db.kvartirantlar) {
        if (db.kvartirantlar[k].status === 'aktiv') kvAktiv++;
        else if (db.kvartirantlar[k].status === 'qarz') kvQarz++;
        else if (db.kvartirantlar[k].status === 'arxiv') kvArxiv++;
      }

      const infoStat = `📊 <b>Tinchlik Hostel CRM Umumiy Statistikasi</b>\n\n` +
                       `📍 Viloyatlar soni: <b>${regCount} ta</b>\n` +
                       `🏢 Filiallar soni: <b>${brCount} ta</b>\n` +
                       `🚪 Xonalar soni: <b>${roomCount} ta</b>\n` +
                       `🛏️ Umumiy yotoqlar: <b>${totalBeds} ta</b>\n` +
                       `   - 🟢 Bo'sh yotoq: <b>${boshBeds} ta</b>\n` +
                       `   - 🔴 Band yotoq: <b>${bandBeds} ta</b>\n\n` +
                       `👥 Kvartirantlar joriy holati:\n` +
                       `   - Active: <b>${kvAktiv} ta</b>\n` +
                       `   - Qarzdor: <b>${kvQarz} ta</b>\n` +
                       `   - Arxivda: <b>${kvArxiv} ta</b>`;
      return bot.sendMessage(chatId, infoStat, { parse_mode: 'HTML' });
    }

    // --- 🔎 KVARTIRANT QIDIRISH MANTIQI ---
    if (text === '🔎 Kvartirant Qidirish') {
      session.state = 'SEARCHING_KVARTIRANT';
      saveDB();
      return bot.sendMessage(chatId, "Qidirilayotgan kvartirantning Ismi, Telefoni yoki Pasport raqamini kiriting:");
    }

    if (session.state === 'SEARCHING_KVARTIRANT') {
      const query = text.toLowerCase();
      let found = [];
      for (let kId in db.kvartirantlar) {
        let kv = db.kvartirantlar[kId];
        if (
          (kv.fio && kv.fio.toLowerCase().includes(query)) ||
          (kv.phone && kv.phone.includes(query)) ||
          (kv.passport && kv.passport.toLowerCase().includes(query))
        ) {
          found.push(kId);
        }
      }

      if (found.length === 0) {
        session.state = 'IDLE';
        saveDB();
        return bot.sendMessage(chatId, "❌ Hech qanday kvartirant topilmadi.", getMainMenu(uId));
      }

      await bot.sendMessage(chatId, `🔍 <b>${found.length} ta mos keluvchi anketa topildi:</b>`, { parse_mode: 'HTML' });
      for (let fId of found) {
        const txt = generateAnketaText(fId);
        const markup = generateAnketaInlineMarkup(fId);
        await bot.sendMessage(chatId, txt, { parse_mode: 'HTML', reply_markup: markup });
      }
      session.state = 'IDLE';
      saveDB();
      return;
    }

    // ========================================================================
    // ➕ VILOYAT QO'SHISH TIZIMI (Faqat Inline Tugmalar Safi bilan Mukammallashgan)
    // ========================================================================
    if (text === '➕ Viloyat qo\'shish') {
      session.state = 'WAITING_VILOYAT_NAME';
      saveDB();
      return bot.sendMessage(chatId, "📝 Yangi qo'shmoqchi bo'lgan Viloyatingiz nomini yozing:");
    }

    if (session.state === 'WAITING_VILOYAT_NAME') {
      const vName = text.trim();
      const vId = generateId();
      
      db.hostel_structure.regions.push({ id: vId, name: vName });
      session.state = 'IDLE';
      saveDB();

      // Muvaffaqiyatli qo'shilgandan so'ng yangi viloyatni inline ko'rinishda tasdiqlab chiqarish
      const inlineMarkup = {
        inline_keyboard: [[{ text: `📍 ${vName}`, callback_data: `view_reg_${vId}` }]]
      };
      return bot.sendMessage(chatId, `✅ Viloyat muvaffaqiyatli qo'shildi va tizim tugmasiga biriktirildi:`, { reply_markup: inlineMarkup });
    }

    // ========================================================================
    // ➕ FILIAL QO'SHISH TIZIMI (Viloyatlar inline tugma bo'lib chiqadi)
    // ========================================================================
    if (text === '➕ Filial qo\'shish') {
      if (db.hostel_structure.regions.length === 0) {
        return bot.sendMessage(chatId, "⚠️ Avval '➕ Viloyat qo\'shish' orqali kamida bitta viloyat kiriting!");
      }

      // Dinamik inline tugmalar generatsiyasi
      let buttons = [];
      db.hostel_structure.regions.forEach((reg) => {
        buttons.push([{ text: `📍 ${reg.name}`, callback_data: `add_branch_to_${reg.id}` }]);
      });

      return bot.sendMessage(chatId, "🏢 Qaysi viloyatga yangi Filial qo'shmoqchisiz? Quyidagi ro'yxatdan tanlang:", {
        reply_markup: { inline_keyboard: buttons }
      });
    }

    if (session.state === 'WAITING_FILIAL_NAME') {
      const bName = text.trim();
      const rId = session.data.selectedRegionId;
      const bId = generateId();

      db.hostel_structure.branches.push({ id: bId, regionId: rId, name: bName });
      session.state = 'IDLE';
      session.data = {};
      saveDB();

      return bot.sendMessage(chatId, `✅ Yangi filial muvaffaqiyatli saqlandi: <b>${bName}</b>`, { parse_mode: 'HTML', reply_markup: getMainMenu(uId).reply_markup });
    }

    // ========================================================================
    // ➕ XONA QO'SHISH TIZIMI (Filiallar inline tugma shaklida saf tortadi)
    // ========================================================================
    if (text === '➕ Xona qo\'shish') {
      if (db.hostel_structure.branches.length === 0) {
        return bot.sendMessage(chatId, "⚠️ Avval '➕ Filial qo\'shish' orqali kamida bitta filial kiriting!");
      }

      let buttons = [];
      db.hostel_structure.branches.forEach((br) => {
        const parentReg = db.hostel_structure.regions.find(r => r.id === br.regionId);
        const regName = parentReg ? parentReg.name : "Noma'lum";
        buttons.push([{ text: `🏢 ${br.name} (${regName})`, callback_data: `add_room_to_${br.id}` }]);
      });

      return bot.sendMessage(chatId, "🚪 Qaysi filialga yangi Xona qo'shmoqchisiz? Quyidagilardan tanlang:", {
        reply_markup: { inline_keyboard: buttons }
      });
    }

    if (session.state === 'WAITING_ROOM_NUMBER') {
      const rNum = text.trim();
      const bId = session.data.selectedBranchId;
      const roomId = generateId();

      db.hostel_structure.rooms.push({ id: roomId, branchId: bId, roomNumber: rNum });
      session.state = 'IDLE';
      session.data = {};
      saveDB();

      return bot.sendMessage(chatId, `✅ Xona muvaffaqiyatli yaratildi: <b>${rNum}-xona</b>`, { parse_mode: 'HTML', reply_markup: getMainMenu(uId).reply_markup });
    }

    // ========================================================================
    // ➕ YOTOQ QO'SHISH TIZIMI (Filial -> Xona -> Yotoq parametrlari zanjiri)
    // ========================================================================
    if (text === '➕ Yotoq qo\'shish') {
      if (db.hostel_structure.branches.length === 0) {
        return bot.sendMessage(chatId, "⚠️ Avval '➕ Filial qo\'shish' amalini bajaring!");
      }

      let buttons = [];
      db.hostel_structure.branches.forEach((br) => {
        buttons.push([{ text: `🏢 ${br.name}`, callback_data: `add_bed_select_br_${br.id}` }]);
      });

      return bot.sendMessage(chatId, "🛏️ Yangi yotoq qo'shish uchun avval <b>Filialni</b> tanlang:", {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    }

    if (session.state === 'WAITING_BED_NUMBER') {
      const bNum = text.trim();
      session.data.bedNumber = bNum;
      session.state = 'WAITING_BED_PRICE';
      saveDB();
      return bot.sendMessage(chatId, "💰 Ushbu yotoq (койка) uchun oylik ijara narxini kiriting (faqat raqamda, masalan: 600000):");
    }

    if (session.state === 'WAITING_BED_PRICE') {
      const priceNum = Number(text.trim());
      if (isNaN(priceNum)) {
        return bot.sendMessage(chatId, "❌ Iltimos faqat raqam ko'rinishida kiriting! Narxi:");
      }

      const targetRoomId = session.data.selectedRoomId;
      const bedId = generateId();

      db.hostel_structure.beds.push({
        id: bedId,
        roomId: targetRoomId,
        bedNumber: session.data.bedNumber,
        price: priceNum,
        status: 'bosh',
        userId: null
      });

      session.state = 'IDLE';
      session.data = {};
      saveDB();

      return bot.sendMessage(chatId, "✅ Yangi yotoq joyi narxi va parametrlar tizimiga muvaffaqiyatli ulandi!", getMainMenu(uId));
    }


    // --- MANUAL ANKETA OCHISH (ADMIN TOMONIDAN) ---
    if (text === '📝 Yangi Anketa Ochish') {
      session.state = 'ADMIN_CREATE_ANKETA_UID';
      saveDB();
      return bot.sendMessage(chatId, "Kvartirantning Telegram ID raqamini kiriting (Ushbu ID orqali bot unga bildirishnomalar yuboradi):");
    }

    if (session.state === 'ADMIN_CREATE_ANKETA_UID') {
      const targetUid = Number(text.trim());
      if (isNaN(targetUid)) return bot.sendMessage(chatId, "ID faqat raqam bo'ladi. Qayta kiriting:");

      session.data.targetUid = targetUid;
      session.state = 'ADMIN_ANKETA_FIO';
      saveDB();
      return bot.sendMessage(chatId, "Ism, Familiya va Sharifini kiriting (F.I.O):");
    }

    if (session.state === 'ADMIN_ANKETA_FIO') {
      session.data.fio = text.trim();
      session.state = 'ADMIN_ANKETA_PHONE';
      saveDB();
      return bot.sendMessage(chatId, "Telefon raqamini kiriting (Masalan: +998901234567):");
    }

    if (session.state === 'ADMIN_ANKETA_PHONE') {
      session.data.phone = text.trim();
      session.state = 'ADMIN_ANKETA_PASSPORT';
      saveDB();
      return bot.sendMessage(chatId, "Pasport seriyasi va raqamini kiriting:");
    }

    if (session.state === 'ADMIN_ANKETA_PASSPORT') {
      session.data.passport = text.trim();
      
      // Endi joy ajratish uchun strukturani ko'rsatamiz
      if (db.hostel_structure.regions.length === 0) {
        return bot.sendMessage(chatId, "⚠️ Tizimda viloyat topilmadi. Avval viloyat yarating.", getMainMenu(uId));
      }

      let buttons = [];
      db.hostel_structure.regions.forEach(reg => {
        buttons.push([{ text: reg.name, callback_data: `anketa_reg_${reg.id}` }]);
      });

      session.state = 'ADMIN_ANKETA_SELECT_REG';
      saveDB();

      return bot.sendMessage(chatId, "Kvartirant joylashadigan <b>Viloyatni</b> tanlang:", {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    }

    if (session.state === 'ADMIN_ANKETA_START_DATE') {
      session.data.startDate = text.trim();
      session.state = 'ADMIN_ANKETA_END_DATE';
      saveDB();
      return bot.sendMessage(chatId, "Ijarani tugash sanasini kiriting (Format: DD.MM.YYYY, Masalan: 26.07.2026):");
    }

    if (session.state === 'ADMIN_ANKETA_END_DATE') {
      session.data.endDate = text.trim();
      
      const targetBId = session.data.selectedBedId;
      const targetUId = session.data.targetUid;
      const bedObj = db.hostel_structure.beds.find(b => b.id === targetBId);

      if (!bedObj) {
        session.state = 'IDLE';
        saveDB();
        return bot.sendMessage(chatId, "⚠️ Xatolik: Tanlangan yotoq topilmadi.", getMainMenu(uId));
      }

      // Kvartirantni bazaga yozish
      db.kvartirantlar[targetUId] = {
        fio: session.data.fio,
        phone: session.data.phone,
        passport: session.data.passport,
        bedId: targetBId,
        startDate: session.data.startDate,
        endDate: session.data.endDate,
        monthlyPrice: bedObj.price,
        status: 'aktiv',
        groupMsgId: null
      };

      // Yotoq holatini band qilish
      bedObj.status = 'band';
      bedObj.userId = targetUId;

      const txt = generateAnketaText(targetUId);
      const markup = generateAnketaInlineMarkup(targetUId);

      // Aktivlar guruhiga yuborish
      if (db.settings.Aktiv_Guruh) {
        try {
          const gMsg = await bot.sendMessage(db.settings.Aktiv_Guruh, `✅ <b>YANGI FAOL ANKETA:</b>\n\n${txt}`, {
            parse_mode: 'HTML',
            reply_markup: markup
          });
          db.kvartirantlar[targetUId].groupMsgId = gMsg.message_id;
        } catch (err) {
          console.error("Guruhga yozishda muammo:", err);
        }
      }

      session.state = 'IDLE';
      session.data = {};
      saveDB();

      await bot.sendMessage(chatId, "✅ Anketa muvaffaqiyatli ochildi va guruhga sinxronizatsiya qilindi!", getMainMenu(uId));
      await bot.sendMessage(targetUId, `🎉 Xush kelibsiz! Sizga Tinchlik Hostel CRM tizimidan joy ajratildi.\n\n${txt}`, { parse_mode: 'HTML' }).catch(()=>{});
      return;
    }

  }

  // ==========================================
  // O'Z-O'ZINI RO'YXATDAN O'TKAZISH (KVARTIRANT REJIM)
  // ==========================================
  if (!isAdmin(uId)) {
    if (text === '📝 Anketa To\'ldirish') {
      session.state = 'USER_FIO';
      saveDB();
      return bot.sendMessage(chatId, "Iltimos, To'liq ism familiyangizni kiriting (F.I.O):");
    }

    if (session.state === 'USER_FIO') {
      session.data.fio = text.trim();
      session.state = 'USER_PHONE';
      saveDB();
      return bot.sendMessage(chatId, "Telefon raqamingizni kiriting:");
    }

    if (session.state === 'USER_PHONE') {
      session.data.phone = text.trim();
      session.state = 'USER_PASSPORT';
      saveDB();
      return bot.sendMessage(chatId, "Pasport seriyasi va raqamingizni kiriting:");
    }

    if (session.state === 'USER_PASSPORT') {
      session.data.passport = text.trim();
      
      // Admin tasdiqlashiga yuborish mantiqi
      session.state = 'IDLE';
      saveDB();

      await bot.sendMessage(chatId, "⏳ Rahmat! Ma'lumotlaringiz qabul qilindi. Admin joy ajratib anketangizni tasdiqlashi bilanoq sizga xabar yuboramiz.");
      
      // Super adminga bildirishnoma yuborish
      const notifyText = `🔔 <b>Yangi Ariza kirdi (O'z-o'zini ro'yxatdan o'tkazish):</b>\n\n` +
                         `👤 ID: <code>${uId}</code>\n` +
                         `👤 FIO: ${session.data.fio}\n` +
                         `📞 Tel: ${session.data.phone}\n` +
                         `🪪 Pasport: ${session.data.passport}\n\n` +
                         `📝 Ushbu foydalanuvchiga joy berish uchun <b>"Yangi Anketa Ochish"</b> tugmasidan foydalaning.`;
      return bot.sendMessage(MAIN_SUPER_ADMIN, notifyText, { parse_mode: 'HTML' });
    }

    if (text === 'ℹ️ Mening Holatim') {
      if (!db.kvartirantlar[uId]) {
        return bot.sendMessage(chatId, "❌ Siz hali tizimda ro'yxatdan o'tmagansiz yoki anketangiz faollashtirilmagan.");
      }
      const activeText = generateAnketaText(uId);
      return bot.sendMessage(chatId, activeText, { parse_mode: 'HTML' });
    }

    if (text === '📞 Admin bilan bog\'lanish') {
      return bot.sendMessage(chatId, `💬 Savollar va muammolar bo'yicha bosh admin bilan bog'laning:\nID: ${MAIN_SUPER_ADMIN}`);
    }
  }

});

// ============================================================================
// CALLBACK_QUERY HANDLER (Ierarxik zanjir va Callback xatoliklari butkul tuzatilgan)
// ============================================================================
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data;
  const uId = callbackQuery.from.id;

  const session = initSession(uId);

  try {
    // --- FILIAL QO'SHISH UCHUN VILOYAT TANLANGANDA ---
    if (data.startsWith('add_branch_to_')) {
      const regId = data.replace('add_branch_to_', '');
      const regObj = db.hostel_structure.regions.find(r => r.id === regId);

      if (!regObj) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Viloyat topilmadi!", show_alert: true });
      }

      session.state = 'WAITING_FILIAL_NAME';
      session.data.selectedRegionId = regId;
      saveDB();

      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.sendMessage(chatId, `📍 <b>${regObj.name}</b> tanlandi.\nEndi ushbu viloyatga qo'shmoqchi bo'lgan <b>Filial nomini</b> yozing:`, { parse_mode: 'HTML' });
    }

    // --- XONA QO'SHISH UCHUN FILIAL TANLANGANDA ---
    if (data.startsWith('add_room_to_')) {
      const brId = data.replace('add_room_to_', '');
      const brObj = db.hostel_structure.branches.find(b => b.id === brId);

      if (!brObj) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Filial topilmadi!", show_alert: true });
      }

      session.state = 'WAITING_ROOM_NUMBER';
      session.data.selectedBranchId = brId;
      saveDB();

      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.sendMessage(chatId, `🏢 <b>${brObj.name}</b> filiali tanlandi.\nEndi yangi qo'shiladigan <b>Xona raqami yoki nomini</b> kiriting:`, { parse_mode: 'HTML' });
    }

    // --- YOTOQ QO'SHISH (1-QADAM): FILIAL TANLANGANDA XONALAR CHIQISHI ---
    if (data.startsWith('add_bed_select_br_')) {
      const brId = data.replace('add_bed_select_br_', '');
      const roomsList = db.hostel_structure.rooms.filter(r => r.branchId === brId);

      if (roomsList.length === 0) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Bu filialda hali xonalar yo'q! Avval xona qo'shing.", show_alert: true });
      }

      let buttons = [];
      roomsList.forEach(rm => {
        buttons.push([{ text: `🚪 ${rm.roomNumber}-xona`, callback_data: `add_bed_select_rm_${rm.id}` }]);
      });

      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("🚪 Endi ushbu filial ichidagi kerakli <b>Xonani</b> tanlang:", {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    }

    // --- YOTOQ QO'SHISH (2-QADAM): XONA TANLANGANDA NOMINI SO'RASH ---
    if (data.startsWith('add_bed_select_rm_')) {
      const rmId = data.replace('add_bed_select_rm_', '');
      
      session.state = 'WAITING_BED_NUMBER';
      session.data.selectedRoomId = rmId;
      saveDB();

      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.sendMessage(chatId, "🛏️ Xona biriktirildi. Endi qo'shilayotgan yotoq (койка) raqamini yoki nomini kiriting:");
    }

    // ========================================================================
    // MANUAL ANKETA OCHISH ZANJIRI (Dinamik callback tekshiruvi)
    // ========================================================================
    if (data.startsWith('anketa_reg_')) {
      const rId = data.replace('anketa_reg_', '');
      const branchesList = db.hostel_structure.branches.filter(b => b.regionId === rId);

      if (branchesList.length === 0) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Bu viloyatda filial yo'q!", show_alert: true });
      }

      let buttons = [];
      branchesList.forEach(b => {
        buttons.push([{ text: b.name, callback_data: `anketa_br_${b.id}` }]);
      });

      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("🏢 Kvartirant joylashadigan <b>Filialni</b> tanlang:", {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    }

    if (data.startsWith('anketa_br_')) {
      const bId = data.replace('anketa_br_', '');
      const roomsList = db.hostel_structure.rooms.filter(r => r.branchId === bId);

      if (roomsList.length === 0) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Bu filialda xonalar yo'q!", show_alert: true });
      }

      let buttons = [];
      roomsList.forEach(r => {
        buttons.push([{ text: `${r.roomNumber}-xona`, callback_data: `anketa_rm_${r.id}` }]);
      });

      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("🚪 Kvartirant joylashadigan <b>Xonani</b> tanlang:", {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    }

    if (data.startsWith('anketa_rm_')) {
      const rmId = data.replace('anketa_rm_', '');
      // Faqat bo'sh yotoqlarni ko'rsatish
      const bedsList = db.hostel_structure.beds.filter(b => b.roomId === rmId && b.status === 'bosh');

      if (bedsList.length === 0) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "Bu xonada bo'sh yotoq qolmagan!", show_alert: true });
      }

      let buttons = [];
      bedsList.forEach(b => {
        buttons.push([{ text: `🛏️ ${b.bedNumber}-койка (${b.price} so'm)`, callback_data: `anketa_bed_${b.id}` }]);
      });

      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.editMessageText("🛏️ Kvartirant uchun <b>Yotoq joyini (койка)</b> tanlang:", {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    }

    if (data.startsWith('anketa_bed_')) {
      const bedId = data.replace('anketa_bed_', '');
      
      session.data.selectedBedId = bedId;
      session.state = 'ADMIN_ANKETA_START_DATE';
      saveDB();

      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.sendMessage(chatId, "📅 Kvartirant kelgan sanani kiriting (Format: DD.MM.YYYY, Masalan: 26.06.2026):");
    }

    // ========================================================================
    // ANKETA STATUSINI GURUHLARARO SINXRONIZATSIYA QILISH VA UNI BOSHQARISH
    // ========================================================================
    if (data.startsWith('set_status_aktiv_')) {
      const targetUId = data.replace('set_status_aktiv_', '');
      if (!db.kvartirantlar[targetUId]) return bot.answerCallbackQuery(callbackQuery.id, { text: "Anketa topilmadi!" });

      // Eski guruh xabarini o'chirish
      if (chatId === db.settings.Qarz_Guruh || chatId === db.settings.Aktiv_Guruh) {
        try { await bot.deleteMessage(chatId, message.message_id); } catch(e){}
      }

      db.kvartirantlar[targetUId].status = 'aktiv';
      saveDB();

      const updatedText = generateAnketaText(targetUId);
      const updatedMarkup = generateAnketaInlineMarkup(targetUId);

      if (db.settings.Aktiv_Guruh) {
        const gMsg = await bot.sendMessage(db.settings.Aktiv_Guruh, `🟢 <b>FAOL HOLATGA O'TKAZILDI:</b>\n\n${updatedText}`, {
          parse_mode: 'HTML',
          reply_markup: updatedMarkup
        });
        db.kvartirantlar[targetUId].groupMsgId = gMsg.message_id;
        saveDB();
      }

      await bot.answerCallbackQuery(callbackQuery.id, { text: "Kvartirant holati AKTIV qilindi!" });
      return;
    }

    if (data.startsWith('set_status_qarz_')) {
      const targetUId = data.replace('set_status_qarz_', '');
      if (!db.kvartirantlar[targetUId]) return bot.answerCallbackQuery(callbackQuery.id, { text: "Anketa topilmadi!" });

      if (chatId === db.settings.Aktiv_Guruh || chatId === db.settings.Qarz_Guruh) {
        try { await bot.deleteMessage(chatId, message.message_id); } catch(e){}
      }

      db.kvartirantlar[targetUId].status = 'qarz';
      saveDB();

      const updatedText = generateAnketaText(targetUId);
      const updatedMarkup = generateAnketaInlineMarkup(targetUId);

      if (db.settings.Qarz_Guruh) {
        const gMsg = await bot.sendMessage(db.settings.Qarz_Guruh, `🚨 <b>QARZDORLAR RO'YXATIGA O'TKAZILDI:</b>\n\n${updatedText}`, {
          parse_mode: 'HTML',
          reply_markup: updatedMarkup
        });
        db.kvartirantlar[targetUId].groupMsgId = gMsg.message_id;
        saveDB();
      }

      await bot.answerCallbackQuery(callbackQuery.id, { text: "Kvartirant holati QARZDOR deb belgilandi!" });
      return;
    }

    if (data.startsWith('set_status_arxiv_')) {
      const targetUId = data.replace('set_status_arxiv_', '');
      const kv = db.kvartirantlar[targetUId];
      if (!kv) return bot.answerCallbackQuery(callbackQuery.id, { text: "Anketa topilmadi!" });

      try { await bot.deleteMessage(chatId, message.message_id); } catch(e){}

      // Yotoq joyini bo'shatish
      if (kv.bedId) {
        const bed = db.hostel_structure.beds.find(b => b.id === kv.bedId);
        if (bed) {
          bed.status = 'bosh';
          bed.userId = null;
        }
      }

      kv.status = 'arxiv';
      saveDB();

      const updatedText = generateAnketaText(targetUId);

      if (db.settings.Arxiv_Guruh) {
        await bot.sendMessage(db.settings.Arxiv_Guruh, `⚫ <b>ARXIVLANGAN ANKETA:</b>\n\n${updatedText}`, { parse_mode: 'HTML' });
      }

      await bot.sendMessage(targetUId, "⚫ Sizning Tinchlik Hostel'dagi ijarangiz yakunlandi va anketangiz arxivga ko'chirildi. Xizmatlarimizdan foydalanganingiz uchun rahmat!");
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Anketa muvaffaqiyatli arxivlandi va joy bo'shatildi!" });
      return;
    }

    if (data.startsWith('confirm_pay_')) {
      const targetUId = data.replace('confirm_pay_', '');
      const kv = db.kvartirantlar[targetUId];
      if (!kv) return bot.answerCallbackQuery(callbackQuery.id, { text: "Anketa topilmadi!" });

      // Oylik muddatni uzaytirish mantiqi (Sana yangilanadi)
      const parts = kv.endDate.split('.');
      if (parts.length === 3) {
        let currentExp = new Date(parts[2], parts[1] - 1, parts[0]);
        currentExp.setMonth(currentExp.getMonth() + 1); // 1 oy qo'shish

        const dd = String(currentExp.getDate()).padStart(2, '0');
        const mm = String(currentExp.getMonth() + 1).padStart(2, '0');
        const yyyy = currentExp.getFullYear();
        
        kv.endDate = `${dd}.${mm}.${yyyy}`;
        kv.status = 'aktiv';
        saveDB();

        // Guruhdagi xabarni yangilash
        try { await bot.deleteMessage(chatId, message.message_id); } catch(e){}

        const updatedText = generateAnketaText(targetUId);
        const updatedMarkup = generateAnketaInlineMarkup(targetUId);

        if (db.settings.Aktiv_Guruh) {
          const gMsg = await bot.sendMessage(db.settings.Aktiv_Guruh, `💰 <b>TO'LOV TASDIQLANDI (MUDDAT UZAYTIRILDI):</b>\n\n${updatedText}`, {
            parse_mode: 'HTML',
            reply_markup: updatedMarkup
          });
          kv.groupMsgId = gMsg.message_id;
          saveDB();
        }

        await bot.sendMessage(targetUId, `✅ To'lovingiz qabul qilindi! Ijara muddatingiz ${kv.endDate} sanasigacha muvaffaqiyatli uzaytirildi. Rahmat!`);
        await bot.answerCallbackQuery(callbackQuery.id, { text: "To'lov tasdiqlandi va muddat 1 oyga uzaytirildi!", show_alert: true });
      }
      return;
    }

    if (data.startsWith('delete_anketa_')) {
      const targetUId = data.replace('delete_anketa_', '');
      const kv = db.kvartirantlar[targetUId];

      if (kv && kv.bedId) {
        const bed = db.hostel_structure.beds.find(b => b.id === kv.bedId);
        if (bed) {
          bed.status = 'bosh';
          bed.userId = null;
        }
      }

      delete db.kvartirantlar[targetUId];
      saveDB();

      try { await bot.deleteMessage(chatId, message.message_id); } catch(e){}
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Anketa tizimdan butkul o'chirib tashlandi!" });
      return;
    }

  } catch (error) {
    console.error("Callback ishlashida xatolik:", error);
    bot.answerCallbackQuery(callbackQuery.id, { text: "Tizimda xatolik yuz berdi." }).catch(() => {});
  }
});

console.log("🚀 Tinchlik Hostel Advanced CRM Bot sinxronizatsiyasi to'liq muvaffaqiyatli yakunlandi!");
