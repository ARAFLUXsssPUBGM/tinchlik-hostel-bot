const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data_db.json');
const MAIN_SUPER_ADMIN = 8485164743;

// Baza boshlang'ich strukturasi
let db = {
  admins: [MAIN_SUPER_ADMIN],
  kvartirantlar: {},
  settings: {
    Aktiv_Guruh: "",
    Qarz_Guruh: "",
    Arxiv_Guruh: "",
    Murojaat_Guruh: ""
  },
  filiallar: ["CHILANZAR", "YUNUSABAD", "SERGELI"],
  xonalar: {},
  payments: []
};

// Bazani yuklash funksiyasi
function loadDB() {
  try {
    if (fs.existsSync(dbPath)) {
      const rawData = fs.readFileSync(dbPath, 'utf8');
      db = JSON.parse(rawData);
      
      // Muhim qismlar mavjudligini ta'minlash
      if (!db.admins) db.admins = [MAIN_SUPER_ADMIN];
      if (!db.admins.includes(MAIN_SUPER_ADMIN)) db.admins.push(MAIN_SUPER_ADMIN);
      if (!db.kvartirantlar) db.kvartirantlar = {};
      if (!db.settings) db.settings = { Aktiv_Guruh: "", Qarz_Guruh: "", Arxiv_Guruh: "", Murojaat_Guruh: "" };
      if (!db.filiallar) db.filiallar = ["CHILANZAR", "YUNUSABAD", "SERGELI"];
      if (!db.xonalar) db.xonalar = {};
      if (!db.payments) db.payments = [];
    } else {
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    }
  } catch (e) {
    console.error("❌ Ma'lumotlar bazasini yuklashda xatolik:", e);
  }
  return db;
}

// Bazani faylga yozish (saqlash)
function saveDB() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error("❌ Ma'lumotlar bazasini saqlashda xatolik:", e);
  }
}

module.exports = {
  db,
  loadDB,
  saveDB,
  MAIN_SUPER_ADMIN
};
  
