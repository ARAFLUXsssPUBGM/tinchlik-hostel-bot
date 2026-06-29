const fs = require('fs');
const { DB_FILE, MAIN_SUPER_ADMIN } = require('../config/constants');

// 1. ASOSIY BAZA STRUKTURASI (Eski va Yangi kodning birlashuvi)
let db = { 
  admins: [MAIN_SUPER_ADMIN], 
  superAdmins: [MAIN_SUPER_ADMIN], 
  
  settings: { 
    hostel_info: "Kiritilmagan", 
    hostel_rules: "Kiritilmagan", 
    card_number: "0000", 
    card_owner: "Mavjud emas", 
    daily_price: 50000, 
    Aktiv_Guruh: null, 
    Qarz_Guruh: null, 
    Ketgan_Guruh: null 
  }, 

  // ZANJIRLI STRUKTURA: Viloyat -> Filial -> Xona -> Yotoq
  // Admin kiritgan barcha obyektlar shu yerga saqlanadi
  hostel_structure: {}, 
  
  // YANGI QO'SHILGAN: Hostel filiallari uchun tanishtiruv rasmlari va matnlari
  introductions: {}, 

  kvartirantlar: {}, 
  archive: [], 
  adminNames: {} 
};

// 2. FAYLNI O'QISH VA YARATISH (Dvigatel)
if (fs.existsSync(DB_FILE)) {
  try { 
    const rawDB = fs.readFileSync(DB_FILE, 'utf8'); 
    if (rawDB.trim()) {
        Object.assign(db, JSON.parse(rawDB)); 
    }
  } catch (e) { 
    console.error("DB O'qishda xatolik yuz berdi:", e); 
  }
} else { 
  // Fayl yo'q bo'lsa, yuqoridagi 'db' qolipidan foydalanib yangi fayl yaratadi
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); 
}

// 3. FUNKSIYALAR
const saveDB = () => { 
  try { 
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); 
  } catch (err) { 
    console.error("Bazani saqlashda xatolik:", err); 
  } 
};

// Boshqa fayllarda bazani chaqirib olish qulay bo'lishi uchun getDB() qo'shildi
const getDB = () => db;

module.exports = { db, getDB, saveDB };
