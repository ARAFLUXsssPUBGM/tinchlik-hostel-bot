// Admin kiritgan ma'lumotlarni (State) qayta ishlovchi universal modul
const { saveDB } = require('../config/db');
const { saveSessions, pushState } = require('../config/sessions');
const { clearAndSend } = require('../utils/interface');
const { backKeyboard } = require('../keyboards/keyboards');
const { formatMoney, parseMoney } = require('../utils/helpers');

async function handleAdminStates(bot, msg, db, sessions, state, adminMainKeyboard, MAIN_SUPER_ADMIN) {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (state === 'ADMIN_SET_RULES') {
    db.settings.hostel_rules = text; saveDB();
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, "✅ Tizim qoidalari yangilandi!", adminMainKeyboard);
  }
  else if (state === 'ADMIN_SET_INFO') {
    db.settings.hostel_info = text; saveDB();
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, "✅ Tanishuv ma'lumotlari yangilandi!", adminMainKeyboard);
  }
  else if (state === 'ADMIN_SET_DAILY') {
    const price = parseMoney(text);
    if (price > 0) {
      db.settings.daily_price = price; saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(bot, chatId, `✅ Kunlik narx <b>${formatMoney(price)}</b> qilib o'rnatildi.`, adminMainKeyboard);
    } else {
      await bot.sendMessage(chatId, "⚠️ Xato summa kiritildi. Qayta urinib ko'ring:");
    }
  }
  else if (state === 'ADMIN_SET_CARD_NUM') {
    db.settings.card_number = text; saveDB();
    pushState(chatId, 'ADMIN_SET_CARD_OWNER');
    await clearAndSend(bot, chatId, "Karta egasining ismini kiriting (F.I.SH):", backKeyboard);
  }
  else if (state === 'ADMIN_SET_CARD_OWNER') {
    db.settings.card_owner = text; saveDB();
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, "✅ Karta rekvizitlari muvaffaqiyatli o'rnatildi!", adminMainKeyboard);
  }
  else if (state === 'ADMIN_BROADCAST') {
    const allUsers = Object.keys(sessions);
    let count = 0;
    allUsers.forEach(uId => {
      if (parseInt(uId, 10) !== chatId) {
        bot.sendMessage(uId, `📢 <b>MA'MURIYAT E'LONI:</b>\n\n${text}`, { parse_mode: 'HTML' }).catch(() => {});
        count++;
      }
    });
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, `✅ E'lon ${count} ta foydalanuvchiga yuborildi.`, adminMainKeyboard);
  }
  else if (state === 'ADMIN_ADD_CHOICE') {
    if (text === "➕ Yangi Admin Qo'shish") {
      pushState(chatId, 'ADMIN_INPUT_NEW_ID');
      await clearAndSend(bot, chatId, "Qo'shmoqchi bo'lgan profilingizning Telegram CHAT ID raqamini yozing:", backKeyboard);
    } else {
      const idMatch = text.match(/Admin ID: (\d+)/);
      if (idMatch) {
        const selectedAdminId = parseInt(idMatch[1], 10);
        sessions[chatId].selectedAdminId = selectedAdminId;
        pushState(chatId, 'ADMIN_MANAGE_ROLE');
        const isSuper = db.superAdmins.includes(selectedAdminId);
        const roleKbd = {
          keyboard: [
            [isSuper ? { text: "🙅‍♂️ Bosh admin huquqini olish" } : { text: "👑 Bosh admin lavozimini berish" }],
            [{ text: "🗑 Adminni o'chirish" }],
            [{ text: "⬅️ Ortga qaytish" }]
          ],
          resize_keyboard: true
        };
        await clearAndSend(bot, chatId, `Admin ID: ${selectedAdminId}\nLavozim: ${isSuper ? 'Super Admin' : 'Oddiy Admin'}\nAmalni tanlang:`, roleKbd);
      }
    }
  }
  else if (state === 'ADMIN_INPUT_NEW_ID') {
    const newAdminId = parseInt(text, 10);
    if (newAdminId) {
      if (!db.admins.includes(newAdminId)) db.admins.push(newAdminId);
      saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(bot, chatId, `✅ Yangi Admin [ID: ${newAdminId}] qo'shildi.`, adminMainKeyboard);
    } else {
      await bot.sendMessage(chatId, "⚠️ Noto'g'ri ID format. Faqat raqam kiriting:");
    }
  }
  else if (state === 'ADMIN_MANAGE_ROLE') {
    const selId = sessions[chatId].selectedAdminId;
    if (text === "👑 Bosh admin lavozimini berish") {
      if (!db.superAdmins.includes(selId)) db.superAdmins.push(selId);
      saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(bot, chatId, "✅ Super admin huquqi berildi!", adminMainKeyboard);
    } else if (text === "🙅‍♂️ Bosh admin huquqini olish") {
      if (selId === MAIN_SUPER_ADMIN) return bot.sendMessage(chatId, "⚠️ Asosiy tizim yaratuvchisidan huquqni olib bo'lmaydi!");
      db.superAdmins = db.superAdmins.filter(id => id !== selId);
      saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(bot, chatId, "✅ Super admin huquqi olindi.", adminMainKeyboard);
    } else if (text === "🗑 Adminni o'chirish") {
      if (selId === MAIN_SUPER_ADMIN) return bot.sendMessage(chatId, "⚠️ Asosiy adminni o'chirish taqiqlanadi!");
      db.admins = db.admins.filter(id => id !== selId);
      db.superAdmins = db.superAdmins.filter(id => id !== selId);
      saveDB(); sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(bot, chatId, "✅ Admin muvaffaqiyatli o'chirildi.", adminMainKeyboard);
    }
  }
  
  // --- HOSTEL STRUKTURA MATRIXI HOLLATI ---
  else if (state === 'ADMIN_HOSTEL_STRUCT') {
    if (text === "➕ Viloyat qo'shish") {
      pushState(chatId, 'STRUCT_ADD_VILOYAT');
      await clearAndSend(bot, chatId, "Yangi viloyat nomini kiriting (Masalan: Toshkent):", backKeyboard);
    } 
    else if (text === "🗑 Viloyatni o'chirish") {
      const keys = Object.keys(db.hostel_structure || {});
      if (keys.length === 0) return bot.sendMessage(chatId, "Bazada o'chirish uchun viloyat yo'q!");
      pushState(chatId, 'STRUCT_DEL_VILOYAT');
      const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
      kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(bot, chatId, "O'chiriladigan viloyatni tanlang (Diqqat: Ichidagi barcha filiallar o'chadi!):", kbd);
    } 
    else if (text === "➕ Filial qo'shish") {
      const keys = Object.keys(db.hostel_structure || {});
      if (keys.length === 0) return bot.sendMessage(chatId, "Avval viloyat qo'shing!");
      pushState(chatId, 'STRUCT_ADD_FILIAL_VIL');
      const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
      kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(bot, chatId, "Qaysi viloyatga filial qo'shmoqchisiz?", kbd);
    } 
    else if (text === "🗑 Filialni o'chirish") {
      const keys = Object.keys(db.hostel_structure || {});
      if (keys.length === 0) return bot.sendMessage(chatId, "Tizimda viloyatlar mavjud emas!");
      pushState(chatId, 'STRUCT_DEL_FILIAL_VIL');
      const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
      kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(bot, chatId, "Filial o'chirish uchun avval viloyatni tanlang:", kbd);
    } 
    else if (text === "➕ Xona qo'shish") {
      const keys = Object.keys(db.hostel_structure || {});
      if (keys.length === 0) return bot.sendMessage(chatId, "Viloyat mavjud emas!");
      pushState(chatId, 'STRUCT_ADD_XONA_VIL');
      const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
      kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(bot, chatId, "Xona qo'shish uchun viloyatni tanlang:", kbd);
    } 
    else if (text === "🗑 Xonani o'chirish") {
      const keys = Object.keys(db.hostel_structure || {});
      pushState(chatId, 'STRUCT_DEL_XONA_VIL');
      const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
      kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(bot, chatId, "Xona o'chirish uchun viloyatni tanlang:", kbd);
    } 
    else if (text === "➕ Yotoq qo'shish") {
      const keys = Object.keys(db.hostel_structure || {});
      pushState(chatId, 'STRUCT_ADD_YOTOQ_VIL');
      const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
      kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(bot, chatId, "Yotoq joyi qo'shish uchun viloyatni tanlang:", kbd);
    } 
    else if (text === "🗑 Yotoqni o'chirish") {
      const keys = Object.keys(db.hostel_structure || {});
      pushState(chatId, 'STRUCT_DEL_YOTOQ_VIL');
      const kbd = { keyboard: keys.map(v => [{ text: v }]), resize_keyboard: true };
      kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
      await clearAndSend(bot, chatId, "Yotoq o'chirish uchun viloyatni tanlang:", kbd);
    }
  }
  
  else if (state === 'STRUCT_ADD_VILOYAT') {
    const regionName = text.trim();
    if (regionName.length < 2 || regionName.startsWith('/') || regionName.includes('back')) {
      return bot.sendMessage(chatId, "⚠️ Noto'g'ri nom! Iltimos, viloyat nomini to'g'ri matn shaklida qaytadan kiriting:");
    }
    if (!sessions[chatId]) sessions[chatId] = {};
    sessions[chatId].tempRegionName = regionName;
    sessions[chatId].state = 'STRUCT_CONFIRM_VILOYAT';
    saveSessions();

    const inlineKeyboard = {
      inline_keyboard: [[
        { text: "✅ Ha, qo'shilsin", callback_data: "confirm_viloyat_yes" },
        { text: "❌ Bekor qilish", callback_data: "confirm_viloyat_no" }
      ]]
    };

    await bot.sendMessage(chatId, `❓ Tizimga yangi viloyat qo'shishni tasdiqlaysizmi?\n\nViloyat nomi: <b>${regionName}</b>`, {
      reply_markup: inlineKeyboard,
      parse_mode: 'HTML'
    });
  }
  else if (state === 'STRUCT_DEL_VILOYAT') {
    if (db.hostel_structure && db.hostel_structure[text]) {
      delete db.hostel_structure[text]; saveDB();
    }
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, `🗑 Viloyat va uning ichidagi barcha ob'ektlar o'chirildi.`, adminMainKeyboard);
  }
  else if (state === 'STRUCT_ADD_FILIAL_VIL') {
    sessions[chatId].tempStruct = { viloyat: text };
    pushState(chatId, 'STRUCT_ADD_FILIAL_NAME');
    await clearAndSend(bot, chatId, `"${text}" viloyati uchun yangi Filial nomini kiriting:`, backKeyboard);
  }
  else if (state === 'STRUCT_ADD_FILIAL_NAME') {
    const vil = sessions[chatId].tempStruct.viloyat;
    const filialName = text.trim();
    if (db.hostel_structure[vil]) {
      if (!db.hostel_structure[vil][filialName]) db.hostel_structure[vil][filialName] = {};
      saveDB();
    }
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, `✅ Filial "${filialName}" muvaffaqiyatli yaratildi.`, adminMainKeyboard);
  }
  else if (state === 'STRUCT_DEL_FILIAL_VIL') {
    sessions[chatId].tempStruct = { viloyat: text };
    pushState(chatId, 'STRUCT_DEL_FILIAL_NAME');
    const filials = Object.keys(db.hostel_structure[text] || {});
    const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
    kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
    await clearAndSend(bot, chatId, "O'chiriladigan filialni belgilang:", kbd);
  }
  else if (state === 'STRUCT_DEL_FILIAL_NAME') {
    const vil = sessions[chatId].tempStruct.viloyat;
    if (db.hostel_structure[vil] && db.hostel_structure[vil][text]) {
      delete db.hostel_structure[vil][text]; saveDB();
    }
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, `🗑 Filial tizimdan to'liq tozalab tashlandi.`, adminMainKeyboard);
  }
  else if (state === 'STRUCT_ADD_XONA_VIL') {
    sessions[chatId].tempStruct = { viloyat: text };
    pushState(chatId, 'STRUCT_ADD_XONA_FIL');
    const filials = Object.keys(db.hostel_structure[text] || {});
    const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
    await clearAndSend(bot, chatId, "Filialni tanlang:", kbd);
  }
  else if (state === 'STRUCT_ADD_XONA_FIL') {
    sessions[chatId].tempStruct.filial = text;
    pushState(chatId, 'STRUCT_ADD_XONA_NAME');
    await clearAndSend(bot, chatId, "Xona raqami yoki nomini kiriting (Masalan: 104-xona):", backKeyboard);
  }
  else if (state === 'STRUCT_ADD_XONA_NAME') {
    const vil = sessions[chatId].tempStruct.viloyat;
    const fil = sessions[chatId].tempStruct.filial;
    const roomName = text.trim();
    if (db.hostel_structure[vil] && db.hostel_structure[vil][fil]) {
      if (!db.hostel_structure[vil][fil][roomName]) db.hostel_structure[vil][fil][roomName] = {};
      saveDB();
    }
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, `✅ Xona "${roomName}" omborga qo'shildi.`, adminMainKeyboard);
  }
  else if (state === 'STRUCT_DEL_XONA_VIL') {
    sessions[chatId].tempStruct = { viloyat: text };
    pushState(chatId, 'STRUCT_DEL_XONA_FIL');
    const filials = Object.keys(db.hostel_structure[text] || {});
    const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
    await clearAndSend(bot, chatId, "Filialni tanlang:", kbd);
  }
  else if (state === 'STRUCT_DEL_XONA_FIL') {
    const vil = sessions[chatId].tempStruct.viloyat;
    sessions[chatId].tempStruct.filial = text;
    pushState(chatId, 'STRUCT_DEL_XONA_NAME');
    const xonalar = Object.keys(db.hostel_structure[vil][text] || {});
    const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true };
    await clearAndSend(bot, chatId, "O'chiriladigan xonani belgilang:", kbd);
  }
  else if (state === 'STRUCT_DEL_XONA_NAME') {
    const vil = sessions[chatId].tempStruct.viloyat;
    const fil = sessions[chatId].tempStruct.filial;
    if (db.hostel_structure[vil] && db.hostel_structure[vil][fil]) {
      delete db.hostel_structure[vil][fil][text]; saveDB();
    }
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, `🗑 Xona o'chirildi.`, adminMainKeyboard);
  }
  else if (state === 'STRUCT_ADD_YOTOQ_VIL') {
    sessions[chatId].tempStruct = { viloyat: text };
    pushState(chatId, 'STRUCT_ADD_YOTOQ_FIL');
    const filials = Object.keys(db.hostel_structure[text] || {});
    const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
    await clearAndSend(bot, chatId, "Filialni bosing:", kbd);
  }
  else if (state === 'STRUCT_ADD_YOTOQ_FIL') {
    const vil = sessions[chatId].tempStruct.viloyat;
    sessions[chatId].tempStruct.filial = text;
    pushState(chatId, 'STRUCT_ADD_YOTOQ_XON');
    const xonalar = Object.keys(db.hostel_structure[vil][text] || {});
    const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true };
    await clearAndSend(bot, chatId, "Xonani tanlang:", kbd);
  }
  else if (state === 'STRUCT_ADD_YOTOQ_XON') {
    sessions[chatId].tempStruct.xona = text;
    pushState(chatId, 'STRUCT_ADD_YOTOQ_NAME');
    await clearAndSend(bot, chatId, "Yotoq joy nomini yozing (Masalan: 1-yotoq (A)):", backKeyboard);
  }
  else if (state === 'STRUCT_ADD_YOTOQ_NAME') {
    sessions[chatId].tempStruct.yotoqName = text.trim();
    pushState(chatId, 'STRUCT_ADD_YOTOQ_PRICE');
    await clearAndSend(bot, chatId, "Ushbu yotoq joyi uchun OYLIK IJARA narxini faqat raqamlarda kiriting:", backKeyboard);
  }
  else if (state === 'STRUCT_ADD_YOTOQ_PRICE') {
    const priceNum = parseMoney(text);
    if (priceNum > 0) {
      const vil = sessions[chatId].tempStruct.viloyat;
      const fil = sessions[chatId].tempStruct.filial;
      const xon = sessions[chatId].tempStruct.xona;
      const yot = sessions[chatId].tempStruct.yotoqName;

      if (!db.hostel_structure[vil]) db.hostel_structure[vil] = {};
      if (!db.hostel_structure[vil][fil]) db.hostel_structure[vil][fil] = {};
      if (!db.hostel_structure[vil][fil][xon]) db.hostel_structure[vil][fil][xon] = {};

      db.hostel_structure[vil][fil][xon][yot] = {
        price: priceNum,
        isFree: true
      };
      saveDB();
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(bot, chatId, `✅ Joy va uning narxi mukammal o'rnatildi!\n<b>Struktura:</b> ${vil} -> ${fil} -> ${xon} -> ${yot}\nNarxi: <b>${formatMoney(priceNum)}</b>`, adminMainKeyboard);
    } else {
      await bot.sendMessage(chatId, "⚠️ Narx xato kiritildi, faqat musbat raqam kiriting:");
    }
  }
  else if (state === 'STRUCT_DEL_YOTOQ_VIL') {
    sessions[chatId].tempStruct = { viloyat: text };
    pushState(chatId, 'STRUCT_DEL_YOTOQ_FIL');
    const filials = Object.keys(db.hostel_structure[text] || {});
    const kbd = { keyboard: filials.map(f => [{ text: f }]), resize_keyboard: true };
    await clearAndSend(bot, chatId, "Filialni belgilang:", kbd);
  }
  else if (state === 'STRUCT_DEL_YOTOQ_FIL') {
    const vil = sessions[chatId].tempStruct.viloyat;
    sessions[chatId].tempStruct.filial = text;
    pushState(chatId, 'STRUCT_DEL_YOTOQ_XON');
    const xonalar = Object.keys(db.hostel_structure[vil][text] || {});
    const kbd = { keyboard: xonalar.map(x => [{ text: x }]), resize_keyboard: true };
    await clearAndSend(bot, chatId, "Xonani belgilang:", kbd);
  }
  else if (state === 'STRUCT_DEL_YOTOQ_XON') {
    const vil = sessions[chatId].tempStruct.viloyat;
    const fil = sessions[chatId].tempStruct.filial;
    sessions[chatId].tempStruct.xona = text;
    pushState(chatId, 'STRUCT_DEL_YOTOQ_NAME');
    const yotoqlar = Object.keys(db.hostel_structure[vil][fil][text] || {});
    const kbd = { keyboard: yotoqlar.map(y => [{ text: y }]), resize_keyboard: true };
    await clearAndSend(bot, chatId, "O'chiriladigan yotoqni tanlang:", kbd);
  }
  else if (state === 'STRUCT_DEL_YOTOQ_NAME') {
    const vil = sessions[chatId].tempStruct.viloyat;
    const fil = sessions[chatId].tempStruct.filial;
    const xon = sessions[chatId].tempStruct.xona;
    if (db.hostel_structure[vil] && db.hostel_structure[vil][fil] && db.hostel_structure[vil][fil][xon]) {
      delete db.hostel_structure[vil][fil][xon][text]; saveDB();
    }
    sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
    await clearAndSend(bot, chatId, "🗑 Yotoq joyi arxitekturadan o'chirildi.", adminMainKeyboard);
  }
  
  // --- ADMIN ESMLATMA KIRITISH HOLATI ---
  else if (state.startsWith('COMMENT_INPUT_')) {
    const targetUserId = state.split('_')[2];
    if (db.kvartirantlar[targetUserId]) {
      db.kvartirantlar[targetUserId].eslatma = text;
      saveDB();
      
      const targetGroup = db.kvartirantlar[targetUserId].status === 'aktiv' ? db.settings.Aktiv_Guruh : db.settings.Qarz_Guruh;
      const msgIdInGroup = db.kvartirantlar[targetUserId].groupMsgId;
      
      if (targetGroup && msgIdInGroup) {
        // global ob'ekt funksiyalaridan foydalanamiz
        const { generateAnketaText, generateAnketaInlineMarkup } = require('../utils/helpers');
        const buildText = generateAnketaText(targetUserId, db, sessions);
        const buildMarkup = generateAnketaInlineMarkup(targetUserId, db.kvartirantlar[targetUserId].status === 'aktiv' ? "group_active" : "group_active");
        try {
          await bot.editMessageCaption(buildText, { chat_id: targetGroup, message_id: msgIdInGroup, reply_markup: buildMarkup, parse_mode: 'HTML' });
        } catch(e){}
      }
      
      sessions[chatId].state = 'ADMIN_MAIN'; saveSessions();
      await clearAndSend(bot, chatId, "📌 Eslatma o'rnatildi va guruhda dinamik ravishda yangilandi!", adminMainKeyboard);
    }
  }
}

module.exports = { handleAdminStates };
    
