require('dotenv').config();
const express = require('express');
const bot = require('./config/botConfig');
require('./services/cronJobs'); // Cron tasklarni ishga tushirish
require('./handlers/textRouter'); // Matnli xabarlar marshrutizatori
require('./handlers/callbackRouter'); // Inline tugmalar marshrutizatori
require('./handlers/photoRouter'); // Rasm marshrutizatori

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Tinchlik Hostel Bot faol va ishlamoqda!');
});

app.listen(PORT, () => {
  console.log(`🚀 Veb-server ${PORT}-portda muvaffaqiyatli tinglamoqda.`);
  console.log("🚀 Tinchlik Hostel Advanced CRM Enterprise Bot muvaffaqiyatli start oldi!");
});
