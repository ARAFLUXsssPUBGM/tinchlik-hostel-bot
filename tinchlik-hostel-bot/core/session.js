const fs = require('fs');
const { SESSION_FILE } = require('../config/constants');

let sessions = {};

if (fs.existsSync(SESSION_FILE)) {
  try {
    const rawSessions = fs.readFileSync(SESSION_FILE, 'utf8');
    if (rawSessions.trim()) Object.assign(sessions, JSON.parse(rawSessions));
  } catch (e) { console.error("⚠️ Sessiya faylini o'qishda xato...", e); }
} else { fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf8'); }

function saveSessions() {
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf8'); } 
  catch (err) { console.error("❌ Sessiya yozishda xato:", err); }
}

module.exports = { sessions, saveSessions };
