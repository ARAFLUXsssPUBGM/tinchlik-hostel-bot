// Kerakli modullarni chaqirish (Eski va Yangi usullar birlashtirildi)
const { sessions, saveSessions } = require('../core/session');
const { popState, handleStateReturn } = require('../utils/navigation');
const { db } = require('../core/database');

// 1. Foydalanuvchi va Kvartirant modullari (Eski)
const personalInfo = require('./registration/personalInfo');
const roomSelection = require('./registration/roomSelection');
const paymentSetup = require('./registration/paymentSetup');
const infoPanel = require('./tenant/infoPanel');
const renewPayment = require('./tenant/renewPayment');

// 2. Admin modullari (Eski va Yangi funksiyalar)
const stats = require('./admin/statistics');
const broadcast = require('./admin/broadcast');
const finance = require('./admin/settings/finance');
const manage = require('./admin/adminControl/manage');
const groupNotes = require('./admin/tenantControl/groupNotes');

// YANGI TIZIM MODULLARI: Struktura va Sozlamalar markazi
const { handleStructureTextInputs } = require('./admin/structure/addItems'); 
const { handleHostelSettings } = require('./admin/settings/hostelInfo'); 

// Router dvigateli ishga tushirilmoqda
module.exports = (bot) => {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id; 
        const text = msg.text;

        // Rasm, video yoki komandalar (/start) ni bu router o'tkazib yuboradi
        if (!text || text.startsWith('/')) return;

        // Sessiyani shakllantirish va holatni o'qish (State)
        sessions[chatId] = sessions[chatId] || { state: 'MAIN_MENU', history: [], lastMessageIds: [] };
        const state = sessions[chatId].state;

        // --- GLOBAL ORTGA QAYTISH TUGMASI ---
        if (text === "⬅️ Ortga qaytish") {
            try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}
            const pState = popState(chatId); 
            sessions[chatId].state = pState; 
            saveSessions();
            return await handleStateReturn(bot, chatId, pState); // Bot obyektini uzatish
        }

        // ==========================================
        // 1. FOYDALANUVCHI / KVARTIRANT YO'NALISHLARI
        // ==========================================
        if (state === 'MAIN_MENU' || state.startsWith('REG_FISH') || state.startsWith('REG_BIRTH') || state.startsWith('REG_PHONE') || state.startsWith('REG_PASS') || state.startsWith('REG_JSHSHIR') || state.startsWith('REG_GENDER')) {
            return personalInfo(msg, state);
        }
        if (state.startsWith('REG_CHOOSE_')) return roomSelection(msg, state);
        if (state.startsWith('REG_PAYMENT_')) return paymentSetup(msg, state);
        if (state === 'KVARTIRANT_MENU') return infoPanel(msg, state);
        if (state.startsWith('KVAR_PAY_')) return renewPayment(msg, state);

        // ==========================================
        // 2. ADMIN YO'NALISHLARI (YANGILANGAN QISM)
        // ==========================================
        if (db.admins && db.admins.includes(chatId)) {
            
            // A) Asosiy Admin menyusiga kirilgandagi taqsimot
            if (state === 'ADMIN_MAIN') {
                if (text === "📊 STATISTIKA") return stats(msg);
                if (text === "📢 Xabarnoma") return broadcast(msg, state);
                if (text === "💳 Karta Sozlamalari" || text === "⛅ KUNLIK Toʻlovni sozlash") return finance(msg, state);
                if (text === "👮‍♂️ Admin qoʻshish") return manage(msg, state);
                
                // Yangi tizimga o'tiladigan sozlamalar
                if (text === "📜 Qoida sozlash" || text === "🏨 HOSTEL tanishuv sozlamalari") {
                    return handleHostelSettings(msg, state); 
                }
                if (text === "🏨 HOSTEL Sozlash") {
                    return handleStructureTextInputs(msg, state); 
                }
            }

            // B) YAP-YANGI ZANJIRLI HOLATLAR (Kutish rejimlarini ushlab qolish)
            if (
                state === 'ADMIN_HOSTEL_STRUCT' ||
                state === 'WAITING_REGION_NAME' ||
                state === 'WAITING_BED_PRICE' ||
                state.startsWith('WAITING_BRANCH_NAME|') ||
                state.startsWith('WAITING_ROOM_NAME|') ||
                state.startsWith('WAITING_BED_NAME|') ||
                state.startsWith('STRUCT_ADD_') 
            ) {
                return handleStructureTextInputs(msg, state);
            }

            // C) Qoidalar o'zgartirilayotgan holat
            if (state.startsWith('ADMIN_SET_RULES') || state.startsWith('ADMIN_SET_INFO')) {
                return handleHostelSettings(msg, state);
            }

            // D) Boshqa eskidan qolgan Admin holatlari
            if (state.startsWith('ADMIN_SET_DAILY') || state.startsWith('ADMIN_SET_CARD')) return finance(msg, state);
            if (state === 'ADMIN_BROADCAST') return broadcast(msg, state);
            if (state.startsWith('ADMIN_ADD_') || state.startsWith('ADMIN_INPUT_') || state.startsWith('ADMIN_EDIT_') || state === 'ADMIN_MANAGE_ROLE') return manage(msg, state);
            if (state.startsWith('COMMENT_INPUT_')) return groupNotes(msg, state);
        }
    });
};
      
