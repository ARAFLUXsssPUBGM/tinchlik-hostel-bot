//group_exit_ (Kvartirantni arxivga o'tkazish va yotoqni bo'shatish)
const bot = require('../../../config/botConfig');
const { db, saveDB } = require('../../../core/database');

module.exports = async (query) => {
  const [_, type, userId] = query.data.split('_'); // group_exit_ID
  
  if (type === 'exit') {
    const kv = db.kvartirantlar[userId];
    if (!kv) return;
    
    // Yotoqni bo'shatish
    if (db.hostel_structure[kv.viloyat]?.[kv.filial]?.[kv.xona]?.[kv.yotoq]) {
      db.hostel_structure[kv.viloyat][kv.filial][kv.xona][kv.yotoq].isFree = true;
    }
    
    // Statusni arxivga o'tkazish
    kv.status = 'arxiv';
    db.archive.push(kv);
    delete db.kvartirantlar[userId];
    
    // Guruhdagi xabarni o'chirish
    if (db.settings.Qarz_Guruh && kv.groupMsgId) {
      try { await bot.deleteMessage(db.settings.Qarz_Guruh, kv.groupMsgId); } catch(e){}
    }
    
    saveDB();
    await bot.answerCallbackQuery(query.id, "✅ Kvartirant arxivga o'tkazildi va yotoq bo'shatildi.");
  }
};
