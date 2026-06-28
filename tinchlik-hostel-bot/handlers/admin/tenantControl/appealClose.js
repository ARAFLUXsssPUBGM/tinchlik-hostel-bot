//murojaat_ok (Murojaatni o'qildi qilib yopish)
const bot = require('../../../config/botConfig');

module.exports = async (query) => {
  if (query.data === 'murojaat_ok') {
    try {
      await bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: "✅ O'qildi va Yopildi", callback_data: "none" }]] }, { chat_id: query.message.chat.id, message_id: query.message.message_id });
      bot.answerCallbackQuery(query.id, { text: "Yopildi" });
    } catch(e) {}
  }
};
