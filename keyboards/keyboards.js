const mainKeyboard = {
  keyboard: [
    [{ text: "👤 Roʻyxatdan oʻtish" }],
    [{ text: "🏨 HOSTEL bilan tanishish" }, { text: "📑 HOSTEL Qoidalar" }]
  ],
  resize_keyboard: true
};

const kvartirantKeyboard = {
  keyboard: [
    [{ text: "💰 Toʻlov qilish" }, { text: "📋 Mening profilim" }],
    [{ text: "✍️ Adminga murojaat" }, { text: "📑 HOSTEL Qoidalar" }]
  ],
  resize_keyboard: true
};

const backKeyboard = {
  keyboard: [[{ text: "⬅️ Ortga qaytish" }]],
  resize_keyboard: true
};

const paymentTypeKeyboard = {
  keyboard: [
    [{ text: "💳 Karta orqali" }],
    [{ text: "💵 Naqd pul bilan" }],
    [{ text: "⬅️ Ortga qaytish" }]
  ],
  resize_keyboard: true
};

function adminKeyboard(superAdminId, db) {
  return {
    keyboard: [
      [{ text: "👥 Kvartirantlar" }, { text: "📊 Umumiy Statistika" }],
      [{ text: "🏢 Viloyat/Filial Sozlamalari" }, { text: "⚙️ Bot Sozlamalari" }],
      [{ text: "🔙 Orqaga" }]
    ],
    resize_keyboard: true
  };
}

module.exports = {
  mainKeyboard: kvartirantKeyboard, // Agar asosiy menyu shu bo'lsa
  kvartirantKeyboard,
  backKeyboard,
  paymentTypeKeyboard,
  adminKeyboard // Mana shu yerga adminKeyboard deb yozing!
};
