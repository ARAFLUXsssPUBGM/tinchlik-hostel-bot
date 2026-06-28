const { db } = require('../core/database');
const { formatMoney, formatDate } = require('./formatters');

function generateAnketaText(userId, isNewPayment = false, renewData = null, sessions = null) {
  const data = db.kvartirantlar[userId] || (sessions && sessions[userId]?.regData) || renewData;
  if (!data) return "Ma'lumot topilmadi.";

  let statusTitle = "🔔 YANGI ARIZA/TOʻLOV";
  if (data.status === 'aktiv') statusTitle = "✅ AKTIV KVARTIRANT";
  if (data.status === 'qarz') statusTitle = "⚠️ QARZDOR KVARTIRANT";
  if (data.status === 'arxiv') statusTitle = "⛔️ KETGAN KVARTIRANT (ARXIV)";

  const payType = renewData ? renewData.payType : (data.payType || "Aniqlanmagan");
  const summa = renewData ? renewData.summa : (data.summa || 0);
  const eslatma = data.eslatma || "Mavjud emas";

  let txt = `<b>${statusTitle}</b>\n\n`;
  if (!data.status || isNewPayment) {
    txt += `💵 Toʻlov uslubi: <b>${payType}</b>\n🤝 Toʻlov Summasi: <b>${formatMoney(summa)}</b>\n`;
  }
  txt += `\n👤 F.I.SH: <b>${data.fish || data.name || "Noma'lum"}</b>
📅 Tugʻilgan sana: <b>${data.birth || "-"}</b>
🪪 Pasport: <b>${data.passport || "-"}</b>
🆔 JSHSHIR: <b>${data.jshshir || "-"}</b>
📞 Telefon: <b>${data.phone || "-"}</b>
🚩 Viloyat: <b>${data.viloyat || "-"}</b>
🏨 Filial: <b>${data.filial || "-"}</b>
🚪 Xona: <b>${data.xona || "-"}</b>
🛏 Yotoq joyi: <b>${data.yotoq || "-"}</b>
📅 Ijara muddati: <b>${data.muddati || "-"}</b>
📌 Ma'muriyat Eslatmasi: <b>${eslatma}</b>`;

  if (data.status === 'arxiv') {
    txt += `\n📅 Arxivlangan vaqt: <b>${formatDate(new Date())}</b>`;
  }
  return txt;
}

function generateAnketaInlineMarkup(userId, mode = "admin_verify") {
  if (mode === "admin_verify") {
    return {
      inline_keyboard: [
        [{ text: "👤 Telegram Profilga O'tish", url: `tg://user?id=${userId}` }],
        [{ text: "✅ Tasdiqlash", callback_data: `verify_yes_${userId}` }, { text: "❌ Rad etish", callback_data: `verify_no_${userId}` }]
      ]
    };
  } else if (mode === "group_active") {
    return {
      inline_keyboard: [
        [{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }],
        [{ text: "📌 Eslatma yozish", callback_data: `group_note_${userId}` }, { text: "❌ Kvartirant chiqib ketdi", callback_data: `group_exit_${userId}` }]
      ]
    };
  } else if (mode === "group_archive") {
    return {
      inline_keyboard: [
        [{ text: "👤 Telegram Profili", url: `tg://user?id=${userId}` }],
        [{ text: "📌 Eslatma kiritish", callback_data: `group_note_${userId}` }, { text: "✅ Qayta AKTIV qilish", callback_data: `verify_yes_${userId}` }]
      ]
    };
  }
}

module.exports = { generateAnketaText, generateAnketaInlineMarkup };
