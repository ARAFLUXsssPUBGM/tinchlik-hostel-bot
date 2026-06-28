const bot = require('../config/botConfig');
const { sessions, saveSessions } = require('../core/session');

async function clearAndSend(chatId, text, replyMarkup, isMainMenu = false) {
  if (sessions[chatId]?.lastMessageIds) {
    for (let msgId of sessions[chatId].lastMessageIds) { try { await bot.deleteMessage(chatId, msgId); } catch (e) {} }
    sessions[chatId].lastMessageIds = [];
  } else { sessions[chatId] = sessions[chatId] || {}; sessions[chatId].lastMessageIds = []; }

  try {
    const sentMsg = await bot.sendMessage(chatId, text, { reply_markup: replyMarkup, parse_mode: 'HTML' });
    if (isMainMenu) sessions[chatId].mainMenuBotMsgId = sentMsg.message_id;
    else sessions[chatId].lastMessageIds.push(sentMsg.message_id);
    saveSessions();
  } catch (e) {}
}
module.exports = { clearAndSend };
