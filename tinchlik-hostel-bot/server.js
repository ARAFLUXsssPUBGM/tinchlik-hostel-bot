require('dotenv').config();
const express = require('express');
const bot = require('./config/botConfig'); // 1. Bot dvigateli chaqirib olindi
require('./services/cronJobs'); // 2. Vaqtga bog'liq vazifalar (Cron) ishga tushirildi

const app = express();
const PORT = process.env.PORT || 10000; // 3. Server porti belgilandi

// --- 4. MANTIQIY ROUTERLARNI ULASH (Yangi kod mantiqi asosida) ---
// Bot obyekti argument sifatida (bot) orqali routerlarga yuborilmoqda
require('./handlers/textRouter')(bot);
require('./handlers/callbackRouter')(bot);
require('./handlers/photoRouter')(bot);

// --- 5. ASOSIY BUYRUQLAR (Commands) ---
require('./handlers/commands/start')(bot);
require('./handlers/commands/admin')(bot);
require('./handlers/commands/groupSetup')(bot);

// --- 6. VEB-SERVER (Hosting uchun kerakli qism) ---
app.get('/', (req, res) => res.send('Tinchlik Hostel Bot faol va ishlamoqda!'));

app.listen(PORT, () => {
    console.log(`🚀 Veb-server ${PORT}-portda muvaffaqiyatli tinglamoqda.`);
});

// Start haqida xabarlar
console.log("🚀 Tinchlik Hostel Advanced CRM Enterprise Bot muvaffaqiyatli start oldi!");
console.log("🤖 Bot polling (xabarlarni kutish rejimida) ishga tushirildi...");
