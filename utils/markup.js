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

module.exports = { generateAnketaInlineMarkup };
