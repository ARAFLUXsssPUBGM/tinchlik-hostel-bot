const cron = require('node-cron');
const bot = require('../config/botConfig');
const { db, saveDB } = require('../core/database');
const { generateAnketaText, generateAnketaInlineMarkup } = require('../utils/markupGenerators');

cron.schedule('0 9,14,20 * * *', async () => {
  console.log("⏰ Qarzdorlik zanjiri va ijara muddatlari tekshirilmoqda...");
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
      const warnMsg = `⚠️ <b>DIQQAT OGOHLANTIRISH!</b>\nHurmatli kvartirant, ijara muddatingiz tugashiga <b>${diffDays} kun</b> qoldi. To'lovni amalga oshirishingizni so'raymiz!`;
      await bot.sendMessage(uId, warnMsg, { parse_mode: 'HTML' }).catch(() => {});
    } 
    else if (diffDays <= 0 && kv.status === 'aktiv') {
      if (db.settings.Aktiv_Guruh && kv.groupMsgId) {
        try { await bot.deleteMessage(db.settings.Aktiv_Guruh, kv.groupMsgId); } catch(e){}
      }
      kv.status = 'qarz'; saveDB();
      await bot.sendMessage(uId, "⚠️ Sizning ijara muddatingiz yakunlandi va tizim tomonidan QARZDORLAR ro'yxatiga kiritildingiz!").catch(() => {});

      if (db.settings.Qarz_Guruh) {
        const qarzText = generateAnketaText(uId);
        const qarzMarkup = generateAnketaInlineMarkup(uId, "group_active"); 
        try {
          const sentQarzMsg = await bot.sendPhoto(db.settings.Qarz_Guruh, kv.selfiePhoto, { caption: qarzText, reply_markup: qarzMarkup, parse_mode: 'HTML' });
          db.kvartirantlar[uId].groupMsgId = sentQarzMsg.message_id;
          saveDB();
        } catch(e){}
      }
    }
  }
});
