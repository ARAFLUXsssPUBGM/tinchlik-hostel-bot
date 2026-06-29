//Yangi Viloyat, Filial, Xona, Yotoq + Narx yozib kiritish
const bot = require('../../../config/botConfig');
const { getDB, saveDB } = require('../../../core/database');
const { getSession, saveSession } = require('../../../core/session');
const { pushState } = require('../../../utils/navigation');

// Eski koddagi Asosiy Boshqaruv Menyusi (Reply Keyboard)
const structKbd = {
  keyboard: [
    [{ text: "➕ Viloyat qo'shish" }, { text: "🗑 Viloyatni o'chirish" }],
    [{ text: "➕ Filial qo'shish" }, { text: "🗑 Filialni o'chirish" }],
    [{ text: "➕ Xona qo'shish" }, { text: "🗑 Xonani o'chirish" }],
    [{ text: "➕ Yotoq qo'shish" }, { text: "🗑 Yotoqni o'chirish" }],
    [{ text: "⬅️ Ortga qaytish" }]
  ], 
  resize_keyboard: true
};

// 1. MATNLAR VA ASOSIY TUGMALARNI QABUL QILUVCHI QISM (Eski va yangi yaxlitlangan)
async function handleStructureTextInputs(msg, state) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const db = getDB();
    const session = getSession(chatId);

    // Eski xabarni tozalash (agar iloji bo'lsa)
    try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

    // Asosiy menyuni ochish
    if (state === 'ADMIN_MAIN' && text === "🏨 HOSTEL Sozlash") {
        pushState(chatId, 'ADMIN_HOSTEL_STRUCT');
        return bot.sendMessage(chatId, "Hostel strukturasini boshqarish:", { reply_markup: structKbd });
    }

    // ➕ QO'SHISH TUGMALARI BOSILGANDA (Zanjirning boshi)
    if (state === 'ADMIN_HOSTEL_STRUCT') {
        const regions = db.hostel_structure || {};
        const hasRegions = Object.keys(regions).length > 0;

        if (text === "➕ Viloyat qo'shish") {
            session.state = 'WAITING_REGION_NAME'; saveSession(chatId, session);
            return bot.sendMessage(chatId, "Kiritmoqchi bo'lgan Viloyatingiz nomini chatga yozib yuboring:", { reply_markup: { remove_keyboard: true } });
        }

        if (text === "➕ Filial qo'shish") {
            if (!hasRegions) return bot.sendMessage(chatId, "Hali hech qanday viloyat qo'shilmagan!");
            const kb = Object.keys(regions).map(rId => [{ text: regions[rId].name, callback_data: `add_br_reg_${rId}` }]);
            return bot.sendMessage(chatId, "Filial kiritmoqchi bo'lgan Viloyatingizni tanlang:", { reply_markup: { inline_keyboard: kb } });
        }

        if (text === "➕ Xona qo'shish") {
            if (!hasRegions) return bot.sendMessage(chatId, "Hali hech qanday viloyat qo'shilmagan!");
            const kb = Object.keys(regions).map(rId => [{ text: regions[rId].name, callback_data: `add_rm_reg_${rId}` }]);
            return bot.sendMessage(chatId, "Xona kiritmoqchi bo'lgan Viloyatingizni tanlang:", { reply_markup: { inline_keyboard: kb } });
        }

        if (text === "➕ Yotoq qo'shish") {
            if (!hasRegions) return bot.sendMessage(chatId, "Hali hech qanday viloyat qo'shilmagan!");
            const kb = Object.keys(regions).map(rId => [{ text: regions[rId].name, callback_data: `add_bd_reg_${rId}` }]);
            return bot.sendMessage(chatId, "Yotoq kiritmoqchi bo'lgan Viloyatingizni tanlang:", { reply_markup: { inline_keyboard: kb } });
        }
    }

    // MATN YUBORILGANDA BAZAGA SAQLASH (Yangi qo'shilgan mantiq)
    if (session.state === 'WAITING_REGION_NAME') {
        const regId = 'viloyat_' + Date.now();
        db.hostel_structure[regId] = { name: text, branches: {} };
        saveDB(); session.state = 'ADMIN_HOSTEL_STRUCT'; saveSession(chatId, session);
        return bot.sendMessage(chatId, `✅ <b>${text}</b> viloyati bazaga qo'shildi!`, { parse_mode: 'HTML', reply_markup: structKbd });
    }

    if (session.state && session.state.startsWith('WAITING_BRANCH_NAME|')) {
        const regId = session.state.split('|')[1];
        const brId = 'filial_' + Date.now();
        db.hostel_structure[regId].branches[brId] = { name: text, rooms: {} };
        saveDB(); session.state = 'ADMIN_HOSTEL_STRUCT'; saveSession(chatId, session);
        return bot.sendMessage(chatId, `✅ <b>${text}</b> filiali qo'shildi!`, { parse_mode: 'HTML', reply_markup: structKbd });
    }

    if (session.state && session.state.startsWith('WAITING_ROOM_NAME|')) {
        const [, regId, brId] = session.state.split('|');
        const rmId = 'xona_' + Date.now();
        db.hostel_structure[regId].branches[brId].rooms[rmId] = { name: text, beds: {} };
        saveDB(); session.state = 'ADMIN_HOSTEL_STRUCT'; saveSession(chatId, session);
        return bot.sendMessage(chatId, `✅ <b>${text}</b> xonasi qo'shildi!`, { parse_mode: 'HTML', reply_markup: structKbd });
    }

    if (session.state && session.state.startsWith('WAITING_BED_NAME|')) {
        const [, regId, brId, rmId] = session.state.split('|');
        session.tempData = { regId, brId, rmId, bedName: text };
        session.state = 'WAITING_BED_PRICE'; saveSession(chatId, session);
        return bot.sendMessage(chatId, `Iltimos, endi bu yotoq uchun <b>Oylik narxni</b> raqamlarda yozib yuboring (Masalan: 500000):`, { parse_mode: 'HTML' });
    }

    if (session.state === 'WAITING_BED_PRICE') {
        const { regId, brId, rmId, bedName } = session.tempData;
        const bedId = 'yotoq_' + Date.now();
        const price = parseInt(text.replace(/\D/g, ''));

        if (isNaN(price)) return bot.sendMessage(chatId, "Iltimos, narxni faqat raqamlarda kiriting!");

        db.hostel_structure[regId].branches[brId].rooms[rmId].beds[bedId] = { 
            name: bedName, price: price, isOccupied: false, tenantId: null 
        };
        saveDB(); 
        session.state = 'ADMIN_HOSTEL_STRUCT'; session.tempData = null; saveSession(chatId, session);
        return bot.sendMessage(chatId, `✅ <b>${bedName}</b> (Narxi: ${price} so'm) bazaga muhrlandi!`, { parse_mode: 'HTML', reply_markup: structKbd });
    }
}

// 2. INLINE TUGMALARNI QABUL QILUVCHI QISM (Zanjirli davomiylik)
async function handleStructureCallbacks(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;
    const db = getDB();
    const session = getSession(chatId);

    // FILIAL ZANJIRI
    if (action.startsWith('add_br_reg_')) {
        const regId = action.split('add_br_reg_')[1];
        session.state = `WAITING_BRANCH_NAME|${regId}`; saveSession(chatId, session);
        return bot.sendMessage(chatId, "Iltimos, kiritmoqchi bo'lgan Filial nomini chatga yozing:", { reply_markup: { remove_keyboard: true } });
    }

    // XONA ZANJIRI
    if (action.startsWith('add_rm_reg_')) {
        const regId = action.split('add_rm_reg_')[1];
        const branches = db.hostel_structure[regId].branches;
        if (Object.keys(branches).length === 0) return bot.sendMessage(chatId, "Bu viloyatda filial yo'q!");
        const kb = Object.keys(branches).map(bId => [{ text: branches[bId].name, callback_data: `add_rm_br_${regId}_${bId}` }]);
        return bot.editMessageText("Xona kiritmoqchi bo'lgan Filialingizni tanlang:", { chat_id: chatId, message_id: callbackQuery.message.message_id, reply_markup: { inline_keyboard: kb } });
    }
    if (action.startsWith('add_rm_br_')) {
        const [, , , regId, brId] = action.split('_');
        session.state = `WAITING_ROOM_NAME|${regId}|${brId}`; saveSession(chatId, session);
        return bot.sendMessage(chatId, "Iltimos, kiritmoqchi bo'lgan Xona nomini chatga yozing:", { reply_markup: { remove_keyboard: true } });
    }

    // YOTOQ ZANJIRI
    if (action.startsWith('add_bd_reg_')) {
        const regId = action.split('add_bd_reg_')[1];
        const branches = db.hostel_structure[regId].branches;
        const kb = Object.keys(branches).map(bId => [{ text: branches[bId].name, callback_data: `add_bd_br_${regId}_${bId}` }]);
        return bot.editMessageText("Yotoq kiritmoqchi bo'lgan Filialingizni tanlang:", { chat_id: chatId, message_id: callbackQuery.message.message_id, reply_markup: { inline_keyboard: kb } });
    }
    if (action.startsWith('add_bd_br_')) {
        const [, , , regId, brId] = action.split('_');
        const rooms = db.hostel_structure[regId].branches[brId].rooms;
        const kb = Object.keys(rooms).map(rId => [{ text: rooms[rId].name, callback_data: `add_bd_rm_${regId}_${brId}_${rId}` }]);
        return bot.editMessageText("Yotoq kiritmoqchi bo'lgan Xonani tanlang:", { chat_id: chatId, message_id: callbackQuery.message.message_id, reply_markup: { inline_keyboard: kb } });
    }
    if (action.startsWith('add_bd_rm_')) {
        const [, , , regId, brId, rmId] = action.split('_');
        session.state = `WAITING_BED_NAME|${regId}|${brId}|${rmId}`; saveSession(chatId, session);
        return bot.sendMessage(chatId, "Iltimos, kiritmoqchi bo'lgan Yotoq nomini chatga yozing:", { reply_markup: { remove_keyboard: true } });
    }
}

module.exports = { handleStructureTextInputs, handleStructureCallbacks, structKbd };
              
