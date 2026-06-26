// Eski xabarlarni tozalab, yangi menyularni chalkashliklarsiz yuborish funksiyasi
const { sessions, saveSessions } = require('../config/sessions');

async function clearAndSend(bot, chatId, text, markup = null) {
  if (!sessions[chatId]) {
    sessions[chatId] = { lastMessageIds: [], history: [] };
  }
  if (!sessions[chatId].lastMessageIds) {
    sessions[chatId].lastMessageIds = [];
  }

  // Eski xabarlarni guruh ichida emas, faqat shaxsiy chatda o'chiramiz
  if (chatId > 0) {
    for (const msgId of sessions[chatId].lastMessageIds) {
      try {
        await bot.deleteMessage(chatId, msgId);
      } catch (e) {
        // Xabar allaqachon o'chgan yoki topilmagan bo'lsa xatolik bermasligi uchun
      }
    }
    sessions[chatId].lastMessageIds = [];
  }

  try {
    const options = { parse_mode: 'HTML' };
    if (markup) options.reply_markup = markup;

    const sentMsg = await bot.sendMessage(chatId, text, options);
    
    if (chatId > 0) {
      sessions[chatId].lastMessageIds.push(sentMsg.message_id);
      saveSessions();
    }
    return sentMsg;
  } catch (err) {
    console.error("❌ clearAndSend funksiyasida xatolik:", err);
  }
}

module.exports = { clearAndSend };
