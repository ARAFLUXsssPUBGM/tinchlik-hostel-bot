const fs = require('fs');
const path = require('path');

const sessionsPath = path.join(__dirname, '../sessions.json');
let sessions = {};

// Sessiyalarni yuklash
function loadSessions() {
  try {
    if (fs.existsSync(sessionsPath)) {
      sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    } else {
      fs.writeFileSync(sessionsPath, JSON.stringify({}, null, 2), 'utf8');
    }
  } catch (e) {
    console.error("❌ Sessiyalarni yuklashda xatolik:", e);
  }
  return sessions;
}

// Sessiyalarni saqlash
function saveSessions() {
  try {
    fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (e) {
    console.error("❌ Sessiyalarni saqlashda xatolik:", e);
  }
}

// Holat navigatsiyasi (State push)
function pushState(chatId, state) {
  if (!sessions[chatId]) {
    sessions[chatId] = { history: [], lastMessageIds: [] };
  }
  if (!sessions[chatId].history) {
    sessions[chatId].history = [];
  }
  sessions[chatId].state = state;
  sessions[chatId].history.push(state);
  saveSessions();
}

// Orqaga qaytish (State pop)
function popState(chatId) {
  if (sessions[chatId] && sessions[chatId].history && sessions[chatId].history.length > 1) {
    sessions[chatId].history.pop(); // Hozirgi holatni o'chiramiz
    const prevState = sessions[chatId].history[sessions[chatId].history.length - 1];
    sessions[chatId].state = prevState;
    saveSessions();
    return prevState;
  }
  return null;
}

module.exports = {
  sessions,
  loadSessions,
  saveSessions,
  pushState,
  popState
};
