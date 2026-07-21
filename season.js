(() => {
  function softReset(ratings) {
    if (!Array.isArray(ratings)) return [];
    return ratings.map((elo) => Math.max(0, Math.floor(Number(elo) / 2)));
  }
  function monthFor(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year').value;
    const month = Number(parts.find((part) => part.type === 'month').value);
    const nextYear = month === 12 ? Number(year) + 1 : Number(year);
    const nextMonth = String(month === 12 ? 1 : month + 1).padStart(2, '0');
    return { startsAt: `${year}-${String(month).padStart(2, '0')}-01T00:00:00+07:00`, endsAt: `${nextYear}-${nextMonth}-01T00:00:00+07:00` };
  }
  window.FlagQuizSeason = { softReset, monthFor };
})();
