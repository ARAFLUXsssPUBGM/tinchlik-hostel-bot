// Guruhlar bilan ishlash, arizalarni guruhga yuborish va statuslarni yangilash logikasi
const { generateAnketaText } = require('./helpers');
const { generateAnketaInlineMarkup } = require('./markup');

// Yangi ariza tushganda admin guruhiga (Murojaat_Guruh) yuborish
async function sendNewRequestToGroup(bot, userId, db, sessions) {
  const targetGroup = db.settings?.Murojaat_Guruh;
  if (!targetGroup) {
    console.log("⚠️ Ma'muriyat gurguhi (Murojaat_Guruh) ID si sozlamalarda o'rnatilmagan!");
    return;
  }

  try {
    const text = generateAnketaText(userId, db, sessions, false);
    const markup = generateAnketaInlineMarkup(userId, "admin_verify");

    await bot.sendMessage(targetGroup, text, {
      parse_mode: 'HTML',
      reply_markup: markup
    });
  } catch (error) {
    console.error("❌ Guruhga ariza yuborishda xatolik:", error);
  }
}

// Kvartirant statusi o'zgarganda (Aktiv, Qarz, Arxiv) tegishli guruhga ko'chirish yoki yangilash
async function updateKvartirantInGroup(bot, userId, db, sessions, mode = "group_active") {
  let targetGroup;
  
  if (mode === "group_active") targetGroup = db.settings?.Aktiv_Guruh;
  if (mode === "group_qarz") targetGroup = db.settings?.Qarz_Guruh;
  if (mode === "group_archive") targetGroup = db.settings?.Arxiv_Guruh;

  if (!targetGroup) {
    console.log(`⚠️ Guruh ID topilmadi: ${mode} uchun guruh sozlanmagan.`);
    return;
  }

  try {
    const text = generateAnketaText(userId, db, sessions, false);
    const markup = generateAnketaInlineMarkup(userId, mode);

    // Agar eski guruh xabari ID si saqlangan bo'lsa va status yangilansa, eskisini o'chirib yangi guruhga yuborish mumkin
    // Hozircha to'g'ridan-to'g'ri yangi xabar sifatida guruhga yoziladi
    await bot.sendMessage(targetGroup, text, {
      parse_mode: 'HTML',
      reply_markup: markup
    });
  } catch (error) {
    console.error(`❌ ${mode} guruhiga xabar yuborishda xatolik:`, error);
  }
}

// Yangi to'lov cheki yuborilganda ma'muriyat guruhini ogohlantirish
async function sendPaymentNotification(bot, userId, db, renewData) {
  const targetGroup = db.settings?.Murojaat_Guruh;
  if (!targetGroup) return;

  try {
    const text = `💰 <b>YANGI TO'LOV ARZASI</b>\n\n` + generateAnketaText(userId, db, null, true, renewData);
    
    // To'lovni tasdiqlash uchun inline markup
    const markup = {
      inline_keyboard: [
        [{ text: "👤 Profil", url: `tg://user?id=${userId}` }],
        [{ text: "✅ To'lovni tasdiqlash", callback_data: `pay_yes_${userId}_${renewData.summa}_${renewData.payType}` }, 
         { text: "❌ Rad etish", callback_data: `pay_no_${userId}` }]
      ]
    };

    await bot.sendMessage(targetGroup, text, {
      parse_mode: 'HTML',
      reply_markup: markup
    });
  } catch (error) {
    console.error("❌ Guruhga to'lov bildirishnomasini yuborishda xatolik:", error);
  }
}

module.exports = {
  sendNewRequestToGroup,
  updateKvartirantInGroup,
  sendPaymentNotification
};
          
