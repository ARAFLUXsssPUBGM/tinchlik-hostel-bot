//Inline tugmalar orqali Viloyat, Filial, Xona, Yotoqni o'chirish (dv_v_, df_f_ ...)
const { getDB, saveDB } = require('../../../core/database');

async function handleDeleteCommands(bot, chatId, callbackQuery) {
    const action = callbackQuery.data;
    const db = getDB();
    
    // Ma'lumotlar bazasi kalitini bitta standartga keltiramiz
    // Agar eski db.hostel_structure qolib ketgan bo'lsa, xato bermasligi uchun
    const structures = db.structure || db.hostel_structure || {};

    // 1. VILOYATLAR RO'YXATINI KO'RSATISH (Yangi koddagi menyu mantiqi)
    if (action === 'del_region') {
        const keyboard = Object.keys(structures).map(regId => [
            // Eski koddagi triggerga (del_vil_) moslashtirdik
            { text: `🗑 ${structures[regId].name || regId}`, callback_data: `del_vil_${regId}` } 
        ]);
        keyboard.push([{ text: '🔙 Ortga qaytish', callback_data: 'admin_structure_menu' }]);

        await bot.sendMessage(chatId, "O'chirish kerak bo'lgan viloyatni tanlang (Diqqat: Ichidagi hamma narsa o'chib ketadi!):", {
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    // 2. VILOYATNI BEVOSITA O'CHIRISH (Eski koddagi asosiy vazifa)
    if (action.startsWith('del_vil_')) {
        const regId = action.replace('del_vil_', '');
        
        if (structures[regId]) {
            // Viloyatni bazadan o'chiramiz
            delete structures[regId]; 
            saveDB(db);
            
            // Eski koddagi kabi muvaffaqiyat xabari va o'chirish
            bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Viloyat muvaffaqiyatli o'chirildi!" });
            bot.deleteMessage(chatId, callbackQuery.message.message_id).catch(() => {});
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Viloyat topilmadi!", show_alert: true });
        }
    }

    // 3. YOTOQ O'CHIRISH VA XAVFSIZLIK (Yangi koddagi xavfsizlik mantiqi)
    if (action.startsWith('confirm_del_bed_')) {
        // action formati: confirm_del_bed_regID_branchID_roomID_bedID
        const parts = action.split('_');
        const regId = parts[3];
        const branchId = parts[4];
        const roomId = parts[5];
        const bedId = parts[6];

        try {
            const bed = structures[regId].branches[branchId].rooms[roomId].beds[bedId];

            // MANTIQ: Agar odam bo'lsa, rad etish
            if (bed.isOccupied) {
                return bot.answerCallbackQuery(callbackQuery.id, {
                    text: "❌ RAD ETILDI: Bu yotoqda hozir kvartirant yashamoqda! Avval uni arxivga o'tkazing.",
                    show_alert: true
                });
            }

            // Agar bo'sh bo'lsa o'chirish
            delete structures[regId].branches[branchId].rooms[roomId].beds[bedId];
            saveDB(db);

            // Xabar berish va menyuni tozalash
            await bot.sendMessage(chatId, `✅ Yotoq muvaffaqiyatli zanjirdan uzildi va o'chirildi.`);
            bot.deleteMessage(chatId, callbackQuery.message.message_id).catch(() => {});
            bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Xatolik! Baza elementlari topilmadi.", show_alert: true });
        }
    }
}

module.exports = { handleDeleteCommands };
                      
