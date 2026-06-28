//📊 STATISTIKA (Aktivlar, qarzlar, erkak/ayol, bo'sh yotoqlar hisob-kitobi)
const bot = require('../../config/botConfig');
const { db } = require('../../core/database');
const { clearAndSend } = require('../../utils/helpers');
const { adminMainKeyboard } = require('../../config/keyboards');

module.exports = async (msg) => {
  const chatId = msg.chat.id;
  try { await bot.deleteMessage(chatId, msg.message_id); } catch(e){}

  let total = 0, active = 0, debt = 0;
  for (let key in db.kvartirantlar) {
    total++;
    if (db.kvartirantlar[key].status === 'aktiv') active++;
    if (db.kvartirantlar[key].status === 'qarz') debt++;
  }

  let bedsTotal = 0, bedsFree = 0;
  for (let vil in db.hostel_structure) {
    for (let fil in db.hostel_structure[vil]) {
      for (let xona in db.hostel_structure[vil][fil]) {
        for (let yotoq in db.hostel_structure[vil][fil][xona]) {
          bedsTotal++;
          if (db.hostel_structure[vil][fil][xona][yotoq].isFree) bedsFree++;
        }
      }
    }
  }

  const statText = `📊 <b>Statistika:</b>\n\n` +
                   `👥 Umumiy kvartirantlar: <b>${total}</b>\n` +
                   `✅ Aktivlar: <b>${active}</b>\n` +
                   `⚠️ Qarzdorlar: <b>${debt}</b>\n\n` +
                   `🛏 Umumiy yotoqlar: <b>${bedsTotal}</b>\n` +
                   `🟢 Bo'sh yotoqlar: <b>${bedsFree}</b>`;

  await clearAndSend(chatId, statText, adminMainKeyboard);
};
