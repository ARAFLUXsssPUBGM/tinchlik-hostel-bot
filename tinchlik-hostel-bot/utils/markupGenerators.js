const { db } = require('../core/database');
const { formatMoney, formatDate } = require('./formatters');

module.exports = {
  generateAnketaText: (userId, isNewPayment = false, renewData = null, sess = null) => {
    const data = db.kvartirantlar[userId] || sess?.[userId]?.regData || renewData;
    if (!data) return "Topilmadi";
    let st = "🔔 YANGI ARIZA/TOʻLOV";
    if (data.status === 'aktiv') st = "✅ AKTIV KVARTIRANT";
    if (data.status === 'qarz') st = "⚠️ QARZDOR";
    if (data.status === 'arxiv') st = "⛔️ KETGAN (ARXIV)";
    
    const payType = renewData ? renewData.payType : (data.payType || "Yo'q");
    const summa = renewData ? renewData.summa : (data.summa || 0);
    
    let txt = `<b>${st}</b>\n\n`;
    if (!data.status || isNewPayment) txt += `💵 Uslub: <b>${payType}</b>\n🤝 Summa: <b>${formatMoney(summa)}</b>\n`;
    txt += `\n👤 F.I.SH: <b>${data.fish || "-"}</b>\n📅 Tugʻilgan: <b>${data.birth || "-"}</b>\n📞 Tel: <b>${data.phone || "-"}</b>\n🚩 Viloyat: <b>${data.viloyat || "-"}</b>\n🏨 Filial: <b>${data.filial || "-"}</b>\n🚪 Xona: <b>${data.xona || "-"}</b>\n🛏 Yotoq: <b>${data.yotoq || "-"}</b>\n📅 Muddat: <b>${data.muddati || "-"}</b>\n📌 Eslatma: <b>${data.eslatma || "-"}</b>`;
    return txt;
  },
  generateAnketaInlineMarkup: (userId, mode = "admin_verify") => {
    if (mode === "admin_verify") return { inline_keyboard: [[{ text: "👤 Profil", url: `tg://user?id=${userId}` }], [{ text: "✅ Tasdiqlash", callback_data: `verify_yes_${userId}` }, { text: "❌ Rad etish", callback_data: `verify_no_${userId}` }]] };
    if (mode === "group_active") return { inline_keyboard: [[{ text: "👤 Profil", url: `tg://user?id=${userId}` }], [{ text: "📌 Eslatma", callback_data: `group_note_${userId}` }, { text: "❌ Chiqib ketdi", callback_data: `group_exit_${userId}` }]] };
    if (mode === "group_archive") return { inline_keyboard: [[{ text: "👤 Profil", url: `tg://user?id=${userId}` }], [{ text: "📌 Eslatma", callback_data: `group_note_${userId}` }, { text: "✅ Qayta AKTIV", callback_data: `verify_yes_${userId}` }]] };
  }
};
