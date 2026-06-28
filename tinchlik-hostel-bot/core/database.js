const fs = require('fs');
const { DB_FILE, MAIN_SUPER_ADMIN } = require('../config/constants');
let db = { admins: [MAIN_SUPER_ADMIN], superAdmins: [MAIN_SUPER_ADMIN], settings: { hostel_info: "Kiritilmagan", hostel_rules: "Kiritilmagan", card_number: "0000", card_owner: "Mavjud emas", daily_price: 50000, Aktiv_Guruh: null, Qarz_Guruh: null, Ketgan_Guruh: null }, hostel_structure: {}, kvartirantlar: {}, archive: [], adminNames: {} };

if (fs.existsSync(DB_FILE)) {
  try { const rawDB = fs.readFileSync(DB_FILE, 'utf8'); if (rawDB.trim()) Object.assign(db, JSON.parse(rawDB)); } catch (e) { console.error("DB Xato", e); }
} else { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

const saveDB = () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (err) { console.error(err); } };
module.exports = { db, saveDB };
