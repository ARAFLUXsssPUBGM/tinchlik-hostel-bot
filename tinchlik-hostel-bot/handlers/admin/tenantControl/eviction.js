//group_exit_ (Kvartirantni arxivga o'tkazish va yotoqni bo'shatish)
const bot = require('../../../config/botConfig');
const { db, saveDB } = require('../../../core/database');
const { generateAnketaText, generateAnketaInlineMarkup } = require('../../../utils/markupGenerators');

module.exports = async (query) => {
  const cData = query.data;
  if (cData.startsWith('group_exit_')) {
    const uId = cData.replace('group_exit_', '');
    const kv = db.kvartirantlar[uId];
    if (kv) {
      kv.status = 'arxiv';
      if (db.hostel_structure[kv.viloyat]?.[kv.filial]?.[kv.xona]?.[kv.yotoq]) {
        db.hostel_structure[kv.viloyat][kv.filial][kv.xona][kv.yotoq].isFree = true;
      }
      bot.answerCallbackQuery(query.id, { text: "Arxivlandi." });
      bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: "⛔️ ARXIVGA OLINDI", callback_data: "none" }]] }, { chat_id: query.message.chat.id, message_id: query.message.message_id });
      
      if (db.settings.Ketgan_Guruh) {
        try { await bot.sendPhoto(db.settings.Ketgan_Guruh, kv.selfiePhoto, { caption: generateAnketaText(uId), reply_markup: generateAnketaInlineMarkup(uId, "group_archive"), parse_mode: 'HTML' }); } catch(e){}
      }
      saveDB();
    }
  }
};
