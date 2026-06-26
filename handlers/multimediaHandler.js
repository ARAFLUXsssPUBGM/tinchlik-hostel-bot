// Foydalanuvchilar va kvartirantlar rasm yuborganda ishlovchi mukammal modul
const { pushState, saveSessions } = require('../config/sessions');
const { clearAndSend } = require('../utils/interface');
const { genderKeyboard, mainKeyboard, kvartirantKeyboard } = require('../keyboards/keyboards');

async function handleMultimedia(bot, msg, db, sessions, sendRequestToAdmins, sendRenewRequestToAdmins, sendMurojaatToAdmins) {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) return;
  const state = sessions[chatId].state;

  if (state === 'REG_SELFIE') {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    sessions[chatId].regData.selfiePhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    pushState(chatId, 'REG_GENDER');
    await clearAndSend(bot, chatId, "7. Jinsingizni belgilang:", genderKeyboard);
  }
  else if (state === 'REG_SEND_CHEK') {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    sessions[chatId].regData.chekPhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    await sendRequestToAdmins(chatId, true);
    sessions[chatId].state = 'MAIN_MENU'; saveSessions();
    await clearAndSend(bot, chatId, "Soʻrovingiz Adminga yuborildi. Chek tekshirilib tasdiqlangach bot faollashadi.", mainKeyboard);
  }
  else if (state === 'KVAR_SEND_CHEK') {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    sessions[chatId].renewData.chekPhoto = photoId;
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    await sendRenewRequestToAdmins(chatId, true);
    sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
    await clearAndSend(bot, chatId, "To'lov skrinshoti adminga yetkazildi. Tekshiruvdan so'ng muddatingiz yangilanadi.", kvartirantKeyboard);
  }
  else if (state === 'KVAR_SEND_MUROJAAT') {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    const captionText = msg.caption || "Matnsiz rasm ilova qilindi.";
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
    await sendMurojaatToAdmins(chatId, photoId, captionText);
    sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions();
    await clearAndSend(bot, chatId, "Murojaatingiz barcha adminlarga yuborildi!", kvartirantKeyboard);
  }
}

module.exports = { handleMultimedia };
