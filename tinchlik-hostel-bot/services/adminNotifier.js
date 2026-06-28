const bot = require('../config/botConfig');
const { db } = require('../core/database');
const { sessions, saveSessions } = require('../core/session');
const { generateAnketaText, generateAnketaInlineMarkup } = require('../utils/markupGenerators');

module.exports = {
  sendRequestToAdmins: async (userId, hasChek = false) => {
    const regData = sessions[userId].regData;
    const txt = generateAnketaText(userId, false, null, sessions);
    const markup = generateAnketaInlineMarkup(userId, "admin_verify");
    sessions[userId].adminMsgMap = {};
    for (let admId of db.admins) {
      try {
        let msg = hasChek ? await bot.sendPhoto(admId, regData.chekPhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' }) : regData.selfiePhoto ? await bot.sendPhoto(admId, regData.selfiePhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' }) : await bot.sendMessage(admId, txt, { reply_markup: markup, parse_mode: 'HTML' });
        sessions[userId].adminMsgMap[admId] = msg.message_id;
      } catch (e) {}
    }
    saveSessions();
  },
  sendRenewRequestToAdmins: async (userId, hasChek = false) => {
    const rData = sessions[userId].renewData;
    const txt = generateAnketaText(userId, true, rData, sessions);
    const markup = { inline_keyboard: [[{ text: "👤 Profil", url: `tg://user?id=${userId}` }], [{ text: "✅ Tasdiqlash", callback_data: `renew_yes_${userId}` }, { text: "❌ Rad etish", callback_data: `renew_no_${userId}` }]] };
    sessions[userId].renewMsgMap = {};
    for (let admId of db.admins) {
      try {
        let msg = hasChek ? await bot.sendPhoto(admId, rData.chekPhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' }) : await bot.sendPhoto(admId, db.kvartirantlar[userId].selfiePhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' });
        sessions[userId].renewMsgMap[admId] = msg.message_id;
      } catch(e){}
    }
    saveSessions();
  },
  sendMurojaatToAdmins: async (userId, photoId = null, textMsg = "") => {
    const kv = db.kvartirantlar[userId]; if (!kv) return;
    const txt = `🔔 <b>MUROJAAT</b>\n👤 ${kv.fish}\n🚪 ${kv.xona}, Yotoq: ${kv.yotoq}\n\n📨 ${textMsg}`;
    const markup = { inline_keyboard: [[{ text: "✅ O'qildi (Yopish)", callback_data: `murojaat_ok` }]] };
    for (let admId of db.admins) {
      try { photoId ? await bot.sendPhoto(admId, photoId, { caption: txt, reply_markup: markup, parse_mode: 'HTML' }) : await bot.sendMessage(admId, txt, { reply_markup: markup, parse_mode: 'HTML' }); } catch(e){}
    }
  }
};
