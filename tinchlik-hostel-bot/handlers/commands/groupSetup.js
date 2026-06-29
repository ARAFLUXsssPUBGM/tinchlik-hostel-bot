//   /aktiv, /qarz, /arxiv buyruqlari (Guruhlarni bazaga ulash)
const bot = require('../../config/botConfig');
const { db, saveDB } = require('../../core/database');

// Fayl funksiya ko'rinishida eksport qilinmoqda, endi server.js (bot) ni bemalol uzata oladi
module.exports = (bot) => {
bot.onText(/\/(aktiv|qarz|arxiv)/, async (msg, match) => {
  if (!db.admins.includes(msg.from.id)) return;
  const cmd = match[1];
  if (cmd === "aktiv") { db.settings.Aktiv_Guruh = msg.chat.id; bot.sendMessage(msg.chat.id, "✅ AKTIV bazasi sozlandi."); }
  if (cmd === "qarz") { db.settings.Qarz_Guruh = msg.chat.id; bot.sendMessage(msg.chat.id, "⚠️ QARZDORLAR bazasi sozlandi."); }
  if (cmd === "arxiv") { db.settings.Ketgan_Guruh = msg.chat.id; bot.sendMessage(msg.chat.id, "❌ KETGANLAR arxivi sozlandi."); }
  saveDB();
});
};
  
