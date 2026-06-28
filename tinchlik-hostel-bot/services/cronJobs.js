const cron = require('node-cron');
const bot = require('../config/botConfig');
const { db, saveDB } = require('../core/database');
const { generateAnketaText, generateAnketaInlineMarkup } = require('../utils/markupGenerators');

cron.schedule('0 9,14,20 * * *', async () => {
  const now = new Date();
  for (let uId of Object.keys(db.kvartirantlar || {})) {
    const kv = db.kvartirantlar[uId];
    if (!kv || !['aktiv', 'qarz'].includes(kv.status)) continue;
    const parts = kv.muddati.split('.'); if (parts.length !== 3) continue;
    const expDate = new Date(parts[2], parts[1] - 1, parts[0]);
    const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 3 && diffDays > 0) {
      bot.sendMessage(uId, `⚠️ <b>DIQQAT!</b>\nIjara muddati tugashiga <b>${diffDays} kun</b> qoldi.`, { parse_mode: 'HTML' }).catch(()=>{});
    } else if (diffDays <= 0 && kv.status === 'aktiv') {
      if (db.settings.Aktiv_Guruh && kv.groupMsgId) { try { await bot.deleteMessage(db.settings.Aktiv_Guruh, kv.groupMsgId); } catch(e){} }
      kv.status = 'qarz'; saveDB();
      bot.sendMessage(uId, "⚠️ Ijara muddati yakunlandi. QARZDORLAR ro'yxatidasiz!").catch(()=>{});
      if (db.settings.Qarz_Guruh) {
        try {
          const sentMsg = await bot.sendPhoto(db.settings.Qarz_Guruh, kv.selfiePhoto, { caption: generateAnketaText(uId), reply_markup: generateAnketaInlineMarkup(uId, "group_active"), parse_mode: 'HTML' });
          kv.groupMsgId = sentMsg.message_id; saveDB();
        } catch(e){}
      }
    }
  }
});
