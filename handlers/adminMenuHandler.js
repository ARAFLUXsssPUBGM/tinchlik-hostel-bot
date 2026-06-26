// Admin panelining asosiy matnli tugmalarini qayta ishlovchi mukammal modul
const { pushState } = require('../config/sessions');
const { clearAndSend } = require('../utils/interface');
const { backKeyboard } = require('../keyboards/keyboards');
const { formatMoney } = require('../utils/helpers');

async function handleAdminMenu(bot, msg, db, sessions, adminMainKeyboard) {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "📊 STATISTIKA") {
    let aktivlar = 0, erkaklar = 0, ayollar = 0, qarzdorlar = 0, qarzSumma = 0, buOydaKirdi = 0;
    let boshYotoqlar = 0;

    Object.values(db.kvartirantlar || {}).forEach(k => {
      if (k.status === 'aktiv') {
        aktivlar++;
        if (k.gender === 'Erkak') erkaklar++;
        if (k.gender === 'Ayol') ayollar++;
      }
      if (k.status === 'qarz') {
        qarzdorlar++;
        qarzSumma += (k.summa || 0);
      }
      if (k.joinDate) {
        const d = new Date(k.joinDate);
        const now = new Date();
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) buOydaKirdi++;
      }
    });

    if (db.hostel_structure) {
      Object.values(db.hostel_structure).forEach(v => {
        Object.values(v || {}).forEach(f => {
          Object.values(f || {}).forEach(x => {
            Object.values(x || {}).forEach(y => {
              if (y && y.isFree) boshYotoqlar++;
            });
          });
        });
      });
    }

    const statText = `📊 <b>HOSTEL REAL-VAQT STATISTIKASI</b>\n\n` +
      `👥 Aktiv Kvartirantlar: <b>${aktivlar} ta</b>\n` +
      `👨 Erkaklar: <b>${erkaklar}</b> | 👩 Ayollar: <b>${ayollar}</b>\n\n` +
      `🏢 Bo'sh yotoqlar soni: <b>${boshYotoqlar} ta</b>\n` +
      `📝 Qarzdorlar soni: <b>${qarzdorlar} kishi</b>\n` +
      `💰 Olinmagan qarzlar: <b>${formatMoney(qarzSumma)}</b>\n` +
      `📈 Shu oyda yangi qo'shilganlar: <b>${buOydaKirdi} ta</b>`;
    
    await clearAndSend(bot, chatId, statText, adminMainKeyboard);
    return true;
  }
  
  else if (text === "📜 Qoida sozlash") {
    pushState(chatId, 'ADMIN_SET_RULES');
    await clearAndSend(bot, chatId, `Joriy qoidalar:\n<pre>${db.settings.hostel_rules || "Mavjud emas"}</pre>\n\nYangi qoidalarni matn shaklida yozib yuboring:`, backKeyboard);
    return true;
  }
  
  else if (text === "🏨 HOSTEL tanishuv sozlamalari") {
    pushState(chatId, 'ADMIN_SET_INFO');
    await clearAndSend(bot, chatId, `Joriy tanishtiruv:\n<pre>${db.settings.hostel_info || "Mavjud emas"}</pre>\n\nYangi tanishtiruv matnini kiriting:`, backKeyboard);
    return true;
  }
  
  else if (text === "💳 Karta Sozlamalari") {
    pushState(chatId, 'ADMIN_SET_CARD_NUM');
    await clearAndSend(bot, chatId, `Joriy Karta: <code>${db.settings.card_number || "Sozlanmagan"}</code>\nEgasining ismi: <b>${db.settings.card_owner || "Sozlanmagan"}</b>\n\nYangi karta raqamini faqat raqamlar bilan yozib yuboring:`, backKeyboard);
    return true;
  }
  
  else if (text === "⛅ KUNLIK Toʻlovni sozlash") {
    pushState(chatId, 'ADMIN_SET_DAILY');
    await clearAndSend(bot, chatId, `Joriy universal kunlik narx: <b>${formatMoney(db.settings.daily_price || 0)}</b>\nYangi narxni raqamlarda yozib yuboring:`, backKeyboard);
    return true;
  }
  
  else if (text === "📢 Xabarnoma") {
    pushState(chatId, 'ADMIN_BROADCAST');
    await clearAndSend(bot, chatId, "Barcha foydalanuvchilarga yuboriladigan global e'lon matnini kiriting:", backKeyboard);
    return true;
  }
  
  else if (text === "👮‍♂️ Admin qoʻshish") {
    pushState(chatId, 'ADMIN_ADD_CHOICE');
    let kbd = { keyboard: [], resize_keyboard: true };
    (db.admins || []).forEach(admId => {
      kbd.keyboard.push([{ text: `Admin ID: ${admId}` }]);
    });
    kbd.keyboard.push([{ text: "➕ Yangi Admin Qo'shish" }]);
    kbd.keyboard.push([{ text: "⬅️ Ortga qaytish" }]);
    await clearAndSend(bot, chatId, "👮‍♂️ Adminlarni boshqarish paneli. Kerakli ID'ni tanlang yoki yangisini qo'shing:", kbd);
    return true;
  }
  
  else if (text === "🏨 HOSTEL Sozlash") {
    pushState(chatId, 'ADMIN_HOSTEL_STRUCT');
    const kbd = {
      keyboard: [
        [{ text: "➕ Viloyat qo'shish" }, { text: "🗑 Viloyatni o'chirish" }],
        [{ text: "➕ Filial qo'shish" }, { text: "🗑 Filialni o'chirish" }],
        [{ text: "➕ Xona qo'shish" }, { text: "🗑 Xonani o'chirish" }],
        [{ text: "➕ Yotoq qo'shish" }, { text: "🗑 Yotoqni o'chirish" }],
        [{ text: "⬅️ Ortga qaytish" }]
      ],
      resize_keyboard: true
    };
    await clearAndSend(bot, chatId, "🏨 <b>HOSTEL Struktura Matrixi:</b>\nAmallardan birini tanlang:", kbd);
    return true;
  }

  return false;
}

module.exports = { handleAdminMenu };
    
