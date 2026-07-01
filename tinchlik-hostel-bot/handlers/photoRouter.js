//.  bot.on('photo') -> Rasm (Selfi, Chek, Murojaat) yuklanishini boshqaruvchi
// 17. photoRouter.js
const { db, saveDB } = require('../core/database');
const { sessions, saveSessions } = require('../core/session');
const { pushState } = require('../utils/navigation');
const { clearAndSend } = require('../utils/helpers');
const { genderKeyboard, mainKeyboard, kvartirantKeyboard } = require('../config/keyboards');

const { sendRequestToAdmins, sendRenewRequestToAdmins, sendMurojaatToAdmins } = require('../services/adminNotifier');

module.exports = (bot) => {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;

        if (!msg.photo && !msg.video) return;

        if (!sessions[chatId]) return;
        const state = sessions[chatId].state;

        if (state !== 'WAITING_INTRO_MEDIA') {
            try { await bot.deleteMessage(chatId, msg.message_id); } catch(e) {}
        }

        if (state === 'WAITING_INTRO_MEDIA' && sessions[chatId].currentBranch) {
            const branchId = sessions[chatId].currentBranch;

            if (!db.introductions) db.introductions = {};
            if (!db.introductions[branchId]) db.introductions[branchId] = [];

            let mediaObj = { type: msg.photo ? 'photo' : 'video' };

            if (msg.photo) {
                mediaObj.media = msg.photo[msg.photo.length - 1].file_id;
            } else if (msg.video) {
                mediaObj.media = msg.video.file_id;
            }

            if (msg.caption) {
                mediaObj.caption = msg.caption;
                mediaObj.parse_mode = 'HTML';
            }

            db.introductions[branchId].push(mediaObj);
            saveDB();
            
            return; 
        }
        
        if (!msg.photo) return; 
        const photoId = msg.photo[msg.photo.length - 1].file_id;

        if (state === 'REG_SELFIE') {
            sessions[chatId].regData.selfiePhoto = photoId;
            pushState(chatId, 'REG_GENDER');
            // Tuzatildi: bot argumenti qaytarildi
            await clearAndSend(bot, chatId, "7. Jinsingizni belgilang:", genderKeyboard);
        } 
        else if (state === 'REG_SEND_CHEK') {
            sessions[chatId].regData.chekPhoto = photoId;
            // Tuzatildi: bot argumenti qaytarildi
            await sendRequestToAdmins(bot, chatId, true);
            sessions[chatId].state = 'MAIN_MENU';
            saveSessions();
            // Tuzatildi: bot argumenti qaytarildi
            await clearAndSend(bot, chatId, "Soʻrovingiz Adminga yuborildi. Chek tekshirilib tasdiqlangach bot faollashadi.", mainKeyboard);
        } 
        else if (state === 'KVAR_SEND_CHEK') {
            sessions[chatId].renewData.chekPhoto = photoId;
            // Tuzatildi: bot argumenti qaytarildi
            await sendRenewRequestToAdmins(bot, chatId, true);
            sessions[chatId].state = 'KVARTIRANT_MENU';
            saveSessions();
            // Tuzatildi: bot argumenti qaytarildi
            await clearAndSend(bot, chatId, "To'lov skrinshoti adminga yetkazildi. Tekshiruvdan so'ng muddatingiz yangilanadi.", kvartirantKeyboard);
        } 
        else if (state === 'KVAR_SEND_MUROJAAT') {
            // Tuzatildi: bot argumenti qaytarildi
            await sendMurojaatToAdmins(bot, chatId, photoId, msg.caption || "");
            sessions[chatId].state = 'KVARTIRANT_MENU';
            saveSessions();
            // Tuzatildi: bot argumenti qaytarildi
            await clearAndSend(bot, chatId, "Murojaatingiz barcha adminlarga yuborildi!", kvartirantKeyboard);
        }
    });
};
