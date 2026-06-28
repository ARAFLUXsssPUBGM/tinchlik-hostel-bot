//Inline tugmalar orqali Viloyat, Filial, Xona, Yotoqni o'chirish (dv_v_, df_f_ ...)
const bot = require('../../../config/botConfig');
const { db, saveDB } = require('../../../core/database');

module.exports = async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  // cData "del_vil_...", "del_fil_..." shaklida keladi.
  
  if (data.startsWith('del_vil_')) {
    const vil = data.replace('del_vil_', '');
    if(db.hostel_structure[vil]) {
      delete db.hostel_structure[vil]; saveDB();
      bot.answerCallbackQuery(query.id, { text: "Viloyat o'chirildi!" });
      bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
    }
  }
};
