const bot = require('../config/botConfig');
const deleteItems = require('./admin/structure/deleteItems');
const approvals = require('./admin/tenantControl/approvals');
const eviction = require('./admin/tenantControl/eviction');
const appealClose = require('./admin/tenantControl/appealClose');

bot.on('callback_query', async (query) => {
  const cData = query.data;
  if (cData.startsWith('d') || cData.startsWith('a')) return deleteItems(query);
  if (cData.startsWith('verify_') || cData.startsWith('renew_')) return approvals(query);
  if (cData.startsWith('group_exit_') || cData.startsWith('group_note_')) return eviction(query);
  if (cData === 'murojaat_ok') return appealClose(query);
});
