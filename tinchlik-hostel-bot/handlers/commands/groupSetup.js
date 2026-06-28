//   /aktiv, /qarz, /arxiv buyruqlari (Guruhlarni bazaga ulash)
const bot = require('../../config/botConfig');
const { db, saveDB } = require('../../core/database');

bot.onText(/\/(aktiv|qarz|arxiv)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1];
  if (!db.admins.includes(msg.from.id)) return;

  if (command === "aktiv") { db.settings.Aktiv_Guruh = chatId; await bot.sendMessage(chatId, "✅ Ushbu guruh AKTIV kvartirantlar bazasi sifatida sozlandi."); }
  else if (command === "qarz") { db.settings.Qarz_Guruh = chatId; await bot.sendMessage(chatId, "⚠️ Ushbu guruh QARZDORLAR bazasi sifatida sozlandi."); }
  else if (command === "arxiv") { db.settings.Ketgan_Guruh = chatId; await bot.sendMessage(chatId, "❌ Ushbu guruh KETGAN kvartirantlar arxivi sifatida sozlandi."); }
  saveDB();
});
