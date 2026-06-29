const { getSession, saveSession } = require('../core/session');

// YANGI TIZIM MODULLARI: Struktura va Sozlamalar
const { handleStructureCallbacks } = require('./admin/structure/addItems');
const deleteItems = require('./admin/structure/deleteItems');
const { prepareIntroUpload } = require('./admin/settings/hostelInfo');

// ESKI TIZIM MODULLARI: Kvartirantlar va Arizalar ustidan nazorat
const approvals = require('./admin/tenantControl/approvals');
const eviction = require('./admin/tenantControl/eviction');
const appealClose = require('./admin/tenantControl/appealClose');

module.exports = (bot) => {
    bot.on('callback_query', async (query) => {
        const action = query.data;
        const chatId = query.message.chat.id;

        // ==========================================
        // 1. ZANJIRLI STRUKTURA VA O'CHIRISH (Yangi mantiq)
        // ==========================================
        
        // ➕ QO'SHISH TUGMALARI (Zanjirli kiritish)
        if (action.startsWith('add_')) {
            return handleStructureCallbacks(query);
        }

        // 🗑 O'CHIRISH TUGMALARI (Yotoqda odam bor/yo'qligini tekshirish bilan)
        if (action.startsWith('del_')) {
            return deleteItems(query);
        }

        // ==========================================
        // 2. KVARTIRANT VA ARIZALAR BOSHQARUVI (Eski mantiq)
        // ==========================================
        
        // ✅ / ❌ Arizalarni va To'lovlarni tasdiqlash / rad etish
        if (action.startsWith('verify_') || action.startsWith('renew_')) {
            return approvals(query);
        }

        // 📌 / 🚪 Guruhdagi eslatma yozish va Kvartirantni arxivga ko'chirish
        if (action.startsWith('group_exit_') || action.startsWith('group_note_')) {
            return eviction(query);
        }

        // ✅ Kvartirant murojaatini o'qildi qilib yopish
        if (action === 'murojaat_ok') {
            return appealClose(query);
        }

        // ==========================================
        // 3. HOSTEL TANISHUV VA MEDIA YUKLASH (Yangi mantiq)
        // ==========================================
        
        // 📸 Filial tanlanganda rasm/matn kutish rejimiga o'tish
        if (action.startsWith('setup_intro_')) {
            const branchId = action.split('setup_intro_')[1];
            return prepareIntroUpload(bot, chatId, branchId);
        }

        // ✅ Admin barcha rasmlarni yuklab bo'lib, "Yakunlash" ni bosganda
        if (action === 'finish_intro_upload') {
            const session = getSession(chatId);
            session.state = 'ADMIN_MAIN'; // Asosiy holatga qaytarish
            session.currentBranch = null; // Vaqtinchalik xotirani tozalash
            saveSession(chatId, session);

            bot.answerCallbackQuery(query.id, { text: "✅ Tanishtiruv ma'lumotlari saqlandi!" });
            bot.sendMessage(chatId, "✅ Barcha rasmlar va matnlar muvaffaqiyatli qabul qilindi. Tanishuv bo'limi yangilandi!");
            
            try { 
                await bot.deleteMessage(chatId, query.message.message_id); 
            } catch(e) {}
        }
    });
};
      
