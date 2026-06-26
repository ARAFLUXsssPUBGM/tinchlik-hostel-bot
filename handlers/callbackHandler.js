// Inline tugmalar va Avtomatlashgan 3 mahal tekshiruv tizimi (Cron Job) moduli
const { saveDB } = require('../config/db');
const { saveSessions, pushState } = require('../config/sessions');
const { clearAndSend } = require('../utils/interface');
const { mainKeyboard, adminKeyboard } = require('../keyboards/keyboards');
const { generateAnketaText, generateAnketaInlineMarkup, formatMoney } = require('../utils/helpers');

async function handleCallbackQuery(bot, query, db, sessions, adminMainKeyboard) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  // 1. Yangi viloyat qo'shishni tasdiqlash dinamikasi
  if (data === "confirm_viloyat_yes") {
    const regionName = sessions[chatId]?.tempRegionName;
    if (regionName) {
      if (!db.hostel_structure) db.hostel_structure = {};
      if (!db.hostel_structure[regionName]) db.hostel_structure[regionName] = {};
      saveDB();
      
      delete sessions[chatId].tempRegionName;
      sessions[chatId].state = 'ADMIN_MAIN';
      saveSessions();

      try { await bot.deleteMessage(chatId, messageId); } catch(e){}
      await clearAndSend(bot, chatId, `✅ Yangi viloyat <b>"${regionName}"</b> muvaffaqiyatli tizim matritsasiga qo'shildi!`, adminMainKeyboard);
    }
    return;
  }
  
  if (data === "confirm_viloyat_no") {
    if (sessions[chatId]) delete sessions[chatId].tempRegionName;
    sessions[chatId].state = 'ADMIN_MAIN';
    saveSessions();

    try { await bot.deleteMessage(chatId, messageId); } catch(e){}
    await clearAndSend(bot, chatId, "❌ Viloyat qo'shish bekor qilindi.", adminMainKeyboard);
    return;
  }

  // 2. Kvartirantlar anketasini guruhlarda va shaxsiyda boshqarish (Dinamik interfeys)
  const [action, targetUserId] = data.split('_');
  if (!targetUserId || !db.kvartirantlar[targetUserId]) return;

  const kv = db.kvartirantlar[targetUserId];

  if (action === "comment") {
    pushState(chatId, `COMMENT_INPUT_${targetUserId}`);
    await bot.sendMessage(chatId, `📝 Kvartirant <b>${kv.name}</b> uchun guruhda ko'rinadigan maxsus eslatma/izoh matnini yozing:`, { parse_mode: 'HTML' });
  }
  
  else if (action === "out") {
    // Xonadan chiqarish logikasi: Joyni bo'shatish
    if (db.hostel_structure && kv.region && kv.filial && kv.room && kv.bed) {
      try {
        if (db.hostel_structure[kv.region]?.[kv.filial]?.[kv.room]?.[kv.bed]) {
          db.hostel_structure[kv.region][kv.filial][kv.room][kv.bed].isFree = true;
        }
      } catch(e){}
    }
    kv.status = 'tark-etgan';
    saveDB();

    // Guruhdagi postni yangilash yoki o'chirish
    const targetGroup = kv.status === 'aktiv' ? db.settings.Aktiv_Guruh : db.settings.Qarz_Guruh;
    if (targetGroup && kv.groupMsgId) {
      try {
        await bot.editMessageCaption(`❌ <b>USHBU KVARITRANT HOSTELNI TARK ETDI</b>\n\nIsmi: ${kv.name}\nSana: ${new Date().toLocaleDateString()}`, {
          chat_id: targetGroup,
          message_id: kv.groupMsgId
        });
      } catch(e){}
    }
    
    await bot.sendMessage(chatId, `✅ ${kv.name} tizimda 'tark-etgan' holatiga o'tkazildi va yotoq joyi bo'shatildi.`);
  }
}

// 3. AVTOMATLASHGAN 3 MAHAL TEKSHIRUV ROBOTI (CRON INTERVAL TASK)
function startCronValidationRobot(bot, db, sessions) {
  // Har 6 soatda (kuniga 4 marta mukammal tekshiruv) muddatlarni nazorat qilish
  setInterval(async () => {
    const hozir = new Date();
    
    for (const [uId, kv] of Object.entries(db.kvartirantlar || {})) {
      if (kv.status !== 'aktiv' && kv.status !== 'qarz') continue;
      
      const tugashSana = new Date(kv.endDate);
      const farqVaqt = tugashSana - hozir;
      const farqKun = Math.ceil(farqVaqt / (1000 * 60 * 60 * 24));

      // Holat 1: Muddat tugashiga 3 kun qolganda (Ogohlantirish)
      if (farqKun === 3 && !kv.warned3) {
        kv.warned3 = true; saveDB();
        await bot.sendMessage(uId, `⚠️ <b>DIQQAT OGOHLANTIRISH!</b>\n\nHosteldagi ijara muddatingiz tugashiga <b>3 kun</b> qoldi.\nTo'lov muddatini uzaytirish uchun menyudan foydalaning.`, { parse_mode: 'HTML' }).catch(()=>{});
      }
      
      // Holat 2: Muddat tugashiga 1 kun qolganda (Oxirgi eslatma)
      if (farqKun === 1 && !kv.warned1) {
        kv.warned1 = true; saveDB();
        await bot.sendMessage(uId, `🚨 <b>OXIRGI OGOHLANTIRISH!</b>\n\nErtaga ijara muddatingiz yakunlanadi. Iltimos, bugun to'lovni amalga oshirib chekni botga yuklang!`, { parse_mode: 'HTML' }).catch(()=>{});
      }

      // Holat 3: Muddat o'tib ketganda (Avtomatik Qarzga tushirish va guruhini almashtirish)
      if (farqKun <= 0 && kv.status === 'aktiv') {
        kv.status = 'qarz';
        // Qarz summasini hisoblash (kunlik narx bo'yicha o'sib boradi)
        const kunlikUniversal = db.settings.daily_price || 0;
        kv.summa = (kv.summa || 0) + kunlikUniversal;
        saveDB();

        // Aktiv guruhdan eski postni o'chirishga urinish
        if (db.settings.Aktiv_Guruh && kv.groupMsgId) {
          try { await bot.deleteMessage(db.settings.Aktiv_Guruh, kv.groupMsgId); } catch(e){}
        }

        // Qarz guruhiga yangi dynamic post chiqarish
        if (db.settings.Qarz_Guruh) {
          const text = generateAnketaText(uId, db, sessions);
          const markup = generateAnketaInlineMarkup(uId, "group_active");
          try {
            const m = await bot.sendPhoto(db.settings.Qarz_Guruh, kv.selfiePhoto, { caption: text, reply_markup: markup, parse_mode: 'HTML' });
            kv.groupMsgId = m.message_id;
            saveDB();
          } catch(e){}
        }

        await bot.sendMessage(uId, `🔴 <b>IJARA MUDDATINGIZ TUGADI!</b>\n\nTizim sizni avtomatik ravishda qarzdorlar ro'yxatiga kiritdi. Kunlik qarz hisoblanishi boshlandi: <b>${formatMoney(kunlikUniversal)} / kun</b>.`, { parse_mode: 'HTML' }).catch(()=>{});
      }
      
      // Agar allaqachon qarzda bo'lsa, har kun uchun qarzni o'stirish
      if (farqKun <= 0 && kv.status === 'qarz') {
        const o'tganKunlar = Math.abs(farqKun);
        const kunlikUniversal = db.settings.daily_price || 0;
        kv.summa = o'tganKunlar * kunlikUniversal;
        saveDB();
      }
    }
  }, 1000 * 60 * 60 * 6); // Har 6 soatda aylanadi
}

module.exports = { handleCallbackQuery, startCronValidationRobot };
      
