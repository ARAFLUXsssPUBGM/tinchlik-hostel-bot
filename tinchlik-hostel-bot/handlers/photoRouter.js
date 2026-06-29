//.  bot.on('photo') -> Rasm (Selfi, Chek, Murojaat) yuklanishini boshqaruvchi
const { db, saveDB } = require('../core/database');
const { sessions, saveSessions } = require('../core/session');
const { pushState } = require('../utils/navigation');
const { clearAndSend } = require('../utils/helpers');
const { genderKeyboard, mainKeyboard, kvartirantKeyboard } = require('../config/keyboards');

// Tizimdagi xabarnoma xizmatlari (Adminlarga rasmli arizalarni yuborish)
const { sendRequestToAdmins, sendRenewRequestToAdmins, sendMurojaatToAdmins } = require('../services/adminNotifier');

module.exports = (bot) => {
    // Rasm va videolarni bitta oqimda ushlab olish uchun 'message' hodisasidan foydalanamiz
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;

        // Agar xabarda rasm yoki video bo'lmasa, bu routerni mutlaqo o'tkazib yuboramiz
        if (!msg.photo && !msg.video) return;

        // Sessiya va holatni tekshirish
        if (!sessions[chatId]) return;
        const state = sessions[chatId].state;

        // Foydalanuvchi yuborgan rasmlarni chatdan tozalash 
        // (Faqat adminning "MediaGroup albom" kutish rejimidan tashqari holatlarda tozalanadi)
        if (state !== 'WAITING_INTRO_MEDIA') {
            try { await bot.deleteMessage(chatId, msg.message_id); } catch(e) {}
        }

        // ==========================================
        // 1. ADMIN TOMONIDAN MEDIA YUKLASH (Yangi mantiq)
        // ==========================================
        if (state === 'WAITING_INTRO_MEDIA' && sessions[chatId].currentBranch) {
            const branchId = sessions[chatId].currentBranch;

            // Xavfsizlik: Baza massivlari ochiqligini ta'minlash
            if (!db.introductions) db.introductions = {};
            if (!db.introductions[branchId]) db.introductions[branchId] = [];

            let mediaObj = { type: msg.photo ? 'photo' : 'video' };

            // Eng yuqori sifatli fayl ID sini ajratib olish
            if (msg.photo) {
                mediaObj.media = msg.photo[msg.photo.length - 1].file_id;
            } else if (msg.video) {
                mediaObj.media = msg.video.file_id;
            }

            // Rasm ostidagi matnni (caption) biriktirish
            if (msg.caption) {
                mediaObj.caption = msg.caption;
                mediaObj.parse_mode = 'HTML';
            }

            // Albom massiviga qo'shish
            db.introductions[branchId].push(mediaObj);
            saveDB();
            
            // Dastur bu yerda ortiqcha xabar yubormaydi, fon rejimida saqlab ketaveradi
            return; 
        }

        // ==========================================
        // 2. FOYDALANUVCHI / KVARTIRANT RASMLARI (Eski mantiq)
        // ==========================================
        
        // Quyidagi amallar faqat rasm (photo) talab qiladi
        if (!msg.photo) return; 
        const photoId = msg.photo[msg.photo.length - 1].file_id;

        // A) Yangi ro'yxatdan o'tuvchining selfisi
        if (state === 'REG_SELFIE') {
            sessions[chatId].regData.selfiePhoto = photoId;
            pushState(chatId, 'REG_GENDER');
            await clearAndSend(bot, chatId, "7. Jinsingizni belgilang:", genderKeyboard);
        } 
        // B) Yangi ro'yxatdan o'tuvchining to'lov cheki
        else if (state === 'REG_SEND_CHEK') {
            sessions[chatId].regData.chekPhoto = photoId;
            await sendRequestToAdmins(bot, chatId, true);
            sessions[chatId].state = 'MAIN_MENU';
            saveSessions();
            await clearAndSend(bot, chatId, "Soʻrovingiz Adminga yuborildi. Chek tekshirilib tasdiqlangach bot faollashadi.", mainKeyboard);
        } 
        // C) Eski kvartirantning oylik to'lov cheki
        else if (state === 'KVAR_SEND_CHEK') {
            sessions[chatId].renewData.chekPhoto = photoId;
            await sendRenewRequestToAdmins(bot, chatId, true);
            sessions[chatId].state = 'KVARTIRANT_MENU';
            saveSessions();
            await clearAndSend(bot, chatId, "To'lov skrinshoti adminga yetkazildi. Tekshiruvdan so'ng muddatingiz yangilanadi.", kvartirantKeyboard);
        } 
        // D) Kvartirantning rasmli murojaati
        else if (state === 'KVAR_SEND_MUROJAAT') {
            await sendMurojaatToAdmins(bot, chatId, photoId, msg.caption || "");
            sessions[chatId].state = 'KVARTIRANT_MENU';
            saveSessions();
            await clearAndSend(bot, chatId, "Murojaatingiz barcha adminlarga yuborildi!", kvartirantKeyboard);
        }
    });
};
      
