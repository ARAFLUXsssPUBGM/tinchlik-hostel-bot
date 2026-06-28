const path = require('path');
module.exports = {
  MAIN_SUPER_ADMIN: parseInt(process.env.MAIN_SUPER_ADMIN, 10),
  DB_FILE: path.join(__dirname, '..', 'core', 'database.json'),
  SESSION_FILE: path.join(__dirname, '..', 'core', 'sessions.json')
};
