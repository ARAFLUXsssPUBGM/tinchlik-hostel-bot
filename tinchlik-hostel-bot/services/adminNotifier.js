const bot = require('../config/botConfig');
const { db } = require('../core/database');
const { sessions, saveSessions } = require('../core/session');
const { generateAnketaText, generateAnketaInlineMarkup } = require('../utils/markupGenerators');

async function sendRequestToAdmins(userId, hasChek = false) {
  const regData = sessions[userId].regData;
  const txt = generateAnketaText(userId, false, null, sessions);
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
    } catch (e) { console.log(`Admin ${admId} bloklagan.`); }
  }
  saveSessions();
}

async function sendRenewRequestToAdmins(userId, hasChek = false) {
  const renewData = sessions[userId].renewData;
  const kv = db.kvartirantlar[userId];
  const txt = generateAnketaText(userId, true, renewData, sessions);
  const markup = {
    inline_keyboard: [
      [{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }],
      [{ text: "✅ To'lovni Tasdiqlash", callback_data: `renew_yes_${userId}` }, { text: "❌ Rad etish", callback_data: `renew_no_${userId}` }]
    ]
  };
  sessions[userId].renewMsgMap = {};

  for (let admId of db.admins) {
    try {
      let sentMsg;
      if (hasChek && renewData.chekPhoto) {
        sentMsg = await bot.sendPhoto(admId, renewData.chekPhoto, { caption: txt, reply_markup: markup, parse_mode: 'HTML' });
      } else if (kv && kv.selfiePhoto) {
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
  const murojaatTxt = `🔔 <b>YANGI MUROJAATNOMA</b>\n\n👤 F.I.SH: <b>${kv.fish}</b>\n🚪 Xona: <b>${kv.xona}</b>, Yotoq: <b>${kv.yotoq}</b>\n\n📨 <b>Murojaat matni:</b> ${textMsg}`;
  const markup = { inline_keyboard: [[{ text: "✅ Murojaat o'qildi (Yopish)", callback_data: `murojaat_ok` }]] };

  for (let admId of db.admins) {
    try {
      if (photoId) await bot.sendPhoto(admId, photoId, { caption: murojaatTxt, reply_markup: markup, parse_mode: 'HTML' });
      else if (kv.selfiePhoto) await bot.sendPhoto(admId, kv.selfiePhoto, { caption: murojaatTxt, reply_markup: markup, parse_mode: 'HTML' });
      else await bot.sendMessage(admId, murojaatTxt, { reply_markup: markup, parse_mode: 'HTML' });
    } catch(e){}
  }
}

module.exports = { sendRequestToAdmins, sendRenewRequestToAdmins, sendMurojaatToAdmins };
    
