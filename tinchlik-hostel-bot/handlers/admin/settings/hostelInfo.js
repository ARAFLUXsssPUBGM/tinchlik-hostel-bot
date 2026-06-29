//Qoida sozlash va HOSTEL tanishuv sozlamalari
const bot = require('../../../config/botConfig');
const { getDB, saveDB } = require('../../../core/database');
const { getSession, saveSession } = require('../../../core/session');
const { pushState } = require('../../../utils/navigation');
const { clearAndSend } = require('../../../utils/helpers');
const { backKeyboard, adminMainKeyboard } = require('../../../config/keyboards');

// 1. ASOSIY MENYU VA QOIDALARNI BOSHQARISH (Eski koddan)
async function handleHostelSettings(msg, state) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const db = getDB();

    if (state === 'ADMIN_MAIN') {
        if (text === "📜 Qoida sozlash") {
            pushState(chatId, 'ADMIN_SET_RULES');
            return clearAndSend(chatId, `Joriy qoidalar:\n\n${db.settings.hostel_rules || "Kiritilmagan"}\n\nYangi qoidalarni kiriting:`, backKeyboard);
        }
        if (text === "🏨 HOSTEL tanishuv sozlamalari") {
            return setupHostelInfo(bot, chatId); // Yangi zanjirli tizimga o'tish
        }
    }

    if (state === 'ADMIN_SET_RULES') {
        db.settings.hostel_rules = text; 
        saveDB();
        const session = getSession(chatId);
        session.state = 'ADMIN_MAIN'; 
        saveSession(chatId, session);
        return clearAndSend(chatId, "Qoidalar yangilandi!", adminMainKeyboard);
    }
}

// 2. FILIAL BO'YICHA TANISHUV (Yangi koddan)
async function setupHostelInfo(bot, chatId) {
    const db = getDB();
    const structure = db.hostel_structure || {};
    
    let branchButtons = [];
    for (let regId in structure) {
        for (let branchId in structure[regId].branches) {
            branchButtons.push([{ 
                text: `${structure[regId].name} - ${structure[regId].branches[branchId].name}`, 
                callback_data: `setup_intro_${branchId}` 
            }]);
        }
    }
    branchButtons.push([{ text: '🔙 Ortga qaytish', callback_data: 'admin_menu' }]);

    await bot.sendMessage(chatId, "Qaysi Filialga Tanishtiruv Xabaringizni Kiritmoqchisiz?", {
        reply_markup: { inline_keyboard: branchButtons }
    });
}

// Admin rasm/xabar yuborishi uchun holatni belgilash
async function prepareIntroUpload(bot, chatId, branchId) {
    const session = getSession(chatId);
    session.state = 'WAITING_INTRO_MEDIA';
    session.currentBranch = branchId;
    if (!db.introductions) db.introductions = {}; // Xavfsizlik uchun
    db.introductions[branchId] = []; // Eskisini tozalash
    saveDB();
    saveSession(chatId, session);

    await bot.sendMessage(chatId, "☺️👍 Kiritmoqchi bo'lgan tanishtiruv Rasmlari va Xabaringizni (caption qilib) chatga yuboring. \n\nBarchasini yuborib bo'lgach, '✅ Maʼlumotni Yuklash' tugmasini bosing.", {
        reply_markup: { inline_keyboard: [[{ text: '✅ Maʼlumotni Yuklash', callback_data: 'finish_intro_upload' }]] }
    });
}

// Foydalanuvchi ko'radigan qism
async function showHostelIntroToUser(bot, chatId, branchId) {
    const db = getDB();
    if (db.introductions && db.introductions[branchId] && db.introductions[branchId].length > 0) {
        await bot.sendMediaGroup(chatId, db.introductions[branchId]);
    } else {
        await bot.sendMessage(chatId, "Ushbu Filialga Tanishtiruv xabar kiritilmagan.");
    }
}

module.exports = { 
    handleHostelSettings, 
    setupHostelInfo, 
    prepareIntroUpload, 
    showHostelIntroToUser 
};
