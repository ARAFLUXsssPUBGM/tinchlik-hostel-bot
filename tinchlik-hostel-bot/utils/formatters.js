module.exports = {
  formatMoney: (amount) => String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " soʻm",
  parseMoney: (text) => parseInt(text.replace(/\s+/g, ''), 10) || 0,
  formatDate: (date) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }
};
