function formatMoney(amount) {
  return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
}

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function generateAnketaText(userId, db, sessions, isNewPayment = false, renewData = null) {
  const data = db.kvartirantlar[userId] || sessions[userId]?.regData || renewData;
  if (!data) return "Ma'lumot topilmadi.";

  let statusTitle = "⚠️ YANGI ARIZA/TO'LOV";
  if (data.status === 'aktiv') statusTitle = "✅ AKTIV KVARTIRANT";
  if (data.status === 'qarz') statusTitle = "⚠️ QARZDOR KVARTIRANT";
  if (data.status === 'arxiv') statusTitle = "⛔ KETGAN KVARTIRANT (ARXIV)";

  const payType = renewData ? renewData.payType : (data.payType || "Aniqlanmagan");
  const summa = renewData ? renewData.summa : (data.summa || 0);
  const eslatma = data.eslatma || "Mavjud emas";

  let txt = `<b>${statusTitle}</b>\n\n`;
  if (data.status || isNewPayment) {
    txt += `💳 To'lov uslubi: <b>${payType}</b>\n💵 To'lov Summasi: <b>${formatMoney(summa)}</b>\n`;
  }
  
  txt += `👤 F.I.SH: <b>${data.fish || data.name || "Noma'lum"}</b>\n` +
         `📅 Tug'ilgan sana: <b>${data.birth || "-"}</b>\n` +
         `🪪 Pasport: <b>${data.passport || "-"}</b>\n` +
         `🆔 JSHSHIR: <b>${data.jshshir || "-"}</b>\n` +
         `📞 Telefon: <b>${data.phone || "-"}</b>\n` +
         `📍 Viloyat: <b>${data.viloyat || "-"}</b>\n` +
         `🏢 Filial: <b>${data.filial || "-"}</b>\n` +
         `🚪 Xona: <b>${data.xona || "-"}</b>\n` +
         `🛏️ Yotoq joyi: <b>${data.yotoq || "-"}</b>\n` +
         `📅 Ijara muddati: <b>${data.muddati || "-"}</b>\n` +
         `📌 Ma'muriyat Eslatmasi: <b>${eslatma}</b>`;

  if (data.status === 'arxiv') {
    txt += `\n📅 Arxivlangan vaqt: <b>${formatDate(new Date())}</b>`;
  }
  return txt;
}

module.exports = { formatMoney, formatDate, generateAnketaText };
                          
