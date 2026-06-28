require('dotenv').config();
const express = require('express');
const bot = require('./config/botConfig');
require('./services/cronJobs');
require('./handlers/commands/start');
require('./handlers/commands/admin');
require('./handlers/commands/groupSetup');
require('./handlers/textRouter');
require('./handlers/callbackRouter');
require('./handlers/photoRouter');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Tinchlik Hostel Bot faol va ishlamoqda!'));
app.listen(PORT, () => console.log(`🚀 Veb-server ${PORT}-portda muvaffaqiyatli tinglamoqda.`));
console.log("🚀 Tinchlik Hostel Advanced CRM Enterprise Bot muvaffaqiyatli start oldi!");
