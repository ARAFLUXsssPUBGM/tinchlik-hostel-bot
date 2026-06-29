//Inline tugmalar orqali Viloyat, Filial, Xona, Yotoqni o'chirish (dv_v_, df_f_ ...)
const bot = require('../../../config/botConfig');
const { getDB, saveDB } = require('../../../core/database');

// Yaxlitlangan o'chirish moduli
module.exports = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data; // Masalan: "del_reg_viloyat_123" yoki "del_bed_viloyat_123_filial_123_..."
    const db = getDB();

    // 1. VILOYATNI O'CHIRISH (Zanjir bo'yicha)
    if (action.startsWith('del_reg_')) {
        const regId = action.replace('del_reg_', '');
        if (db.hostel_structure[regId]) {
            delete db.hostel_structure[regId];
            saveDB();
            bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Viloyat va uning ichidagi barcha ma'lumotlar o'chirildi!" });
            bot.deleteMessage(chatId, callbackQuery.message.message_id).catch(() => {});
        }
    }

    // 2. FILIALNI O'CHIRISH
    if (action.startsWith('del_br_')) {
        const [regId, brId] = action.replace('del_br_', '').split('_');
        if (db.hostel_structure[regId]?.branches[brId]) {
            delete db.hostel_structure[regId].branches[brId];
            saveDB();
            bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Filial va uning ichidagi barcha xonalar o'chirildi!" });
            bot.deleteMessage(chatId, callbackQuery.message.message_id).catch(() => {});
        }
    }

    // 3. XONANI O'CHIRISH
    if (action.startsWith('del_rm_')) {
        const [regId, brId, rmId] = action.replace('del_rm_', '').split('_');
        if (db.hostel_structure[regId]?.branches[brId]?.rooms[rmId]) {
            delete db.hostel_structure[regId].branches[brId].rooms[rmId];
            saveDB();
            bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Xona va undagi yotoqlar tozalandi!" });
        }
    }

    // 4. YOTOQNI O'CHIRISH (XAVFSIZLIK TEKSHIRUVI BILAN)
    if (action.startsWith('del_bd_')) {
        const [regId, brId, rmId, bedId] = action.replace('del_bd_', '').split('_');
        const bed = db.hostel_structure[regId]?.branches[brId]?.rooms[rmId]?.beds[bedId];

        if (!bed) return;

        // MANTIQ: Agar yotoqda kvartirant bo'lsa, o'chirishni rad etish
        if (bed.isOccupied) {
            return bot.answerCallbackQuery(callbackQuery.id, {
                text: "❌ RAD ETILDI: Bu yotoqda hozir kvartirant yashamoqda! Avval uni arxivga o'tkazing.",
                show_alert: true
            });
        }

        // Agar bo'sh bo'lsa o'chirish
        delete db.hostel_structure[regId].branches[brId].rooms[rmId].beds[bedId];
        saveDB();
        
        bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Yotoq muvaffaqiyatli o'chirildi!" });
        bot.deleteMessage(chatId, callbackQuery.message.message_id).catch(() => {});
    }
};
