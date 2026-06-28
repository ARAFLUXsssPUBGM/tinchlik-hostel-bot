//verify_yes/no, renew_yes/no (Anketa va To'lovni tasdiqlash/rad etish)
const bot = require('../../../config/botConfig');
const { db, saveDB } = require('../../../core/database');
const { sessions } = require('../../../core/session');
const { generateAnketaText, generateAnketaInlineMarkup } = require('../../../utils/markupGenerators');

module.exports = async (query) => {
  const cData = query.data;
  const msgId = query.message.message_id;
  const chatId = query.message.chat.id;

  if (cData.startsWith('verify_yes_') || cData.startsWith('renew_yes_')) {
    const isRenew = cData.startsWith('renew_');
    const uId = cData.replace(isRenew ? 'renew_yes_' : 'verify_yes_', '');
    
    // Ma'lumotlarni tasdiqlash va bazaga saqlash
    if (!isRenew && sessions[uId]?.regData) {
      db.kvartirantlar[uId] = { ...sessions[uId].regData, status: 'aktiv' };
      db.hostel_structure[db.kvartirantlar[uId].viloyat][db.kvartirantlar[uId].filial][db.kvartirantlar[uId].xona][db.kvartirantlar[uId].yotoq].isFree = false;
    } else if (isRenew && sessions[uId]?.renewData) {
      db.kvartirantlar[uId].muddati = sessions[uId].renewData.muddati;
      db.kvartirantlar[uId].status = 'aktiv';
    }
    saveDB();

    bot.answerCallbackQuery(query.id, { text: "Tasdiqlandi!" });
    bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: "✅ TASDIQLANDI", callback_data: "none" }]] }, { chat_id: chatId, message_id: msgId });
    bot.sendMessage(uId, "Tabriklaymiz, sizning arizangiz tasdiqlandi! /start bosib menyudan foydalanishingiz mumkin.");

    // Aktiv guruhga tashlash
    if (db.settings.Aktiv_Guruh) {
      try {
        const txt = generateAnketaText(uId);
        const mkp = generateAnketaInlineMarkup(uId, "group_active");
        const sm = await bot.sendPhoto(db.settings.Aktiv_Guruh, db.kvartirantlar[uId].selfiePhoto, { caption: txt, reply_markup: mkp, parse_mode: 'HTML' });
        db.kvartirantlar[uId].groupMsgId = sm.message_id; saveDB();
      } catch(e){}
    }
  }

  if (cData.startsWith('verify_no_') || cData.startsWith('renew_no_')) {
    const uId = cData.replace(/verify_no_|renew_no_/, '');
    bot.answerCallbackQuery(query.id, { text: "Rad etildi!" });
    bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: "❌ RAD ETILDI", callback_data: "none" }]] }, { chat_id: chatId, message_id: msgId });
    bot.sendMessage(uId, "Kechirasiz, arizangiz rad etildi.");
  }
};
