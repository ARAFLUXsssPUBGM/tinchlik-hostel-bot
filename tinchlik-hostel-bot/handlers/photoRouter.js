//.  bot.on('photo') -> Rasm (Selfi, Chek, Murojaat) yuklanishini boshqaruvchi
const bot = require('../config/botConfig');
const { sessions, saveSessions } = require('../core/session');
const { pushState } = require('../utils/navigation');
const { clearAndSend } = require('../utils/helpers');
const { genderKeyboard, mainKeyboard, kvartirantKeyboard, backKeyboard } = require('../config/keyboards');
const { sendRequestToAdmins, sendRenewRequestToAdmins, sendMurojaatToAdmins } = require('../services/adminNotifier');

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id; if (!sessions[chatId]) return;
  const state = sessions[chatId].state;
  const photoId = msg.photo[msg.photo.length - 1].file_id;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  if (state === 'REG_SELFIE') { sessions[chatId].regData.selfiePhoto = photoId; pushState(chatId, 'REG_GENDER'); await clearAndSend(chatId, "7. Jinsingiz:", genderKeyboard); }
  else if (state === 'REG_SEND_CHEK') { sessions[chatId].regData.chekPhoto = photoId; await sendRequestToAdmins(chatId, true); sessions[chatId].state = 'MAIN_MENU'; saveSessions(); await clearAndSend(chatId, "So'rov adminga ketdi.", mainKeyboard); }
  else if (state === 'KVAR_SEND_CHEK') { sessions[chatId].renewData.chekPhoto = photoId; await sendRenewRequestToAdmins(chatId, true); sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions(); await clearAndSend(chatId, "Chek adminga ketdi.", kvartirantKeyboard); }
  else if (state === 'KVAR_SEND_MUROJAAT') { await sendMurojaatToAdmins(chatId, photoId, msg.caption || ""); sessions[chatId].state = 'KVARTIRANT_MENU'; saveSessions(); await clearAndSend(chatId, "Murojaat ketdi!", kvartirantKeyboard); }
});
