const fs = require('fs');
const { DB_FILE, MAIN_SUPER_ADMIN } = require('../config/constants');

let db = {
  admins: [MAIN_SUPER_ADMIN],
  superAdmins: [MAIN_SUPER_ADMIN],
  settings: {
    hostel_info: "Hali ma'lumot kiritilmagan",
    hostel_rules: "Hali qoidalar kiritilmagan",
    card_number: "0000 0000 0000 0000",
    card_owner: "Hali mavjud emas",
    daily_price: 50000,
    Aktiv_Guruh: null, Qarz_Guruh: null, Ketgan_Guruh: null
  },
  hostel_structure: {}, kvartirantlar: {}, archive: [], adminNames: {}
};

if (fs.existsSync(DB_FILE)) {
  try {
    const rawDB = fs.readFileSync(DB_FILE, 'utf8');
    if (rawDB.trim()) Object.assign(db, JSON.parse(rawDB));
  } catch (e) { console.error("⚠️ Baza faylini o'qishda xato...", e); }
} else { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); }

function saveDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); } 
  catch (err) { console.error("❌ DB yozishda xato:", err); }
}

module.exports = { db, saveDB };
